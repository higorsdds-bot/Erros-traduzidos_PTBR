const vscode = require('vscode');
const { traduzirLocal, encontrarVocabulario } = require('./tradutor');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { analisar } = require('./analisador');
const { buscarReferencia } = require('./referencia-js');
const { REGEX_LINHA_ERRO, REGEX_CORS, TIPOS_DE_ERRO, limparTexto, pareceErro, interpretarErro, colunaNoArquivo } = require('./erro-colado');
const { analisarModulo } = require('./modulos');

const cache = new Map();        // mensagem -> { texto, fonte }
const falhas = new Map();       // mensagem -> horário da última falha online
const analises = new Map();     // uri -> { versao, mapa: chave do diagnóstico -> análise }
const ESPERA_APOS_FALHA = 60_000;
const LINGUAGENS_JS = new Set(['javascript', 'javascriptreact', 'typescript', 'typescriptreact']);

let decoracao;
let decoracaoLocal;
let canalSaida;
let temporizador;

const config = () => vscode.workspace.getConfiguration('tradutorErros');

const NIVEIS = { erro: 0, aviso: 1, informacao: 2, dica: 3 };
const NOMES = ['Erro', 'Aviso', 'Informação', 'Dica'];
const ICONES = ['🔴', '🟡', '🔵', '💡'];
const CORES = ['editorError.foreground', 'editorWarning.foreground', 'editorInfo.foreground', 'editorHint.foreground'];

// ---------------------------------------------------------------- tradução

async function traduzirOnline(texto) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=' + encodeURIComponent(texto);
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 4000);
  try {
    const resposta = await fetch(url, { signal: controle.signal });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    return dados[0].map((parte) => parte[0]).join('');
  } catch {
    return null;
  } finally {
    clearTimeout(limite);
  }
}

/** Traduz a mensagem inteira (linha por linha). Retorna { texto, fonte } ou null. */
async function traduzir(mensagem) {
  if (cache.has(mensagem)) return cache.get(mensagem);

  const linhas = mensagem.split(/\r?\n/);
  const traduzidas = linhas.map((l) => traduzirLocal(l));
  let fonte = 'dicionário';

  // Mensagens escritas pelo próprio programador já em português (ex.: throw new Error('banco indisponível')).
  traduzidas.forEach((t, i) => {
    const resto = linhas[i].replace(/^(?:Uncaught (?:\(in promise\) )?)?(?:[A-Z]\w*(?:Error|Exception)|Error)(?: \[\w+\])?: /, '');
    if (t === null && /[ãõçáéíóúâêôà]|\b(?:não|nao|erro|inválid[oa]|usuári[oa]|senha|obrigatóri[oa])\b/i.test(resto)) {
      traduzidas[i] = `${linhas[i]} (mensagem já em português, escrita no próprio código com throw new Error)`;
      fonte = 'mensagem do código';
    }
  });

  const pendentes = traduzidas.map((t, i) => (t === null ? i : -1)).filter((i) => i >= 0);
  if (pendentes.length) {
    const ultimaFalha = falhas.get(mensagem);
    if (!config().get('traducaoOnline') || (ultimaFalha && Date.now() - ultimaFalha < ESPERA_APOS_FALHA)) return null;
    // Privacidade: caminhos de arquivos e URLs locais não são enviados ao tradutor (trocados por marcadores).
    const guardados = [];
    const esconder = (s) => s.replace(/(?:file:\/\/\/?|[A-Za-z]:[\\/]|\\\\|(?<![\w.])\/(?=[\w.-]+\/))[^\s'"`)]*|https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])[^\s'"`)]*/g, (c) => {
      guardados.push(c);
      return `[[${guardados.length - 1}]]`;
    });
    const textoPendente = esconder(pendentes.map((i) => linhas[i]).join('\n'));
    let online = await traduzirOnline(textoPendente);
    if (!online) {
      falhas.set(mensagem, Date.now());
      return null;
    }
    online = online.replace(/\[\[\s*(\d+)\s*\]\]/g, (c, n) => guardados[Number(n)] ?? c);
    const partes = online.split('\n');
    pendentes.forEach((i, k) => { traduzidas[i] = partes[k] ?? ''; });
    if (partes.length !== pendentes.length) {
      // O tradutor juntou/separou linhas: usa o texto completo na primeira linha pendente.
      pendentes.forEach((i, k) => { traduzidas[i] = k === 0 ? online : ''; });
    }
    fonte = pendentes.length === linhas.length ? 'tradução automática' : 'dicionário + tradução automática';
  }

  const resultado = { texto: traduzidas.filter((t) => t !== '').join('\n'), fonte };
  cache.set(mensagem, resultado);
  return resultado;
}

// ---------------------------------------------------------------- análise da causa (JavaScript/TypeScript)

const codigoDoDiagnostico = (d) => (typeof d.code === 'object' && d.code !== null ? d.code.value : d.code);

/** Analisa o código ao redor do diagnóstico para achar a causa real. Resultado em cache por versão do arquivo. */
function analisarDiagnostico(documento, d) {
  if (!LINGUAGENS_JS.has(documento.languageId) || !config().get('analisarCausa')) return null;
  const uri = documento.uri.toString();
  let entrada = analises.get(uri);
  if (!entrada || entrada.versao !== documento.version) {
    entrada = { versao: documento.version, mapa: new Map() };
    analises.set(uri, entrada);
  }
  const chave = `${d.range.start.line}:${d.range.start.character}:${codigoDoDiagnostico(d) ?? ''}:${d.message}`;
  if (entrada.mapa.has(chave)) return entrada.mapa.get(chave);
  let r = null;
  try {
    r = analisar(documento.getText(), {
      linha: d.range.start.line,
      coluna: d.range.start.character,
      mensagem: d.message,
      codigo: codigoDoDiagnostico(d),
    });
    if (r && r.local && r.local.linha >= documento.lineCount) r.local = null;
  } catch (erro) {
    console.error('[Tradutor de Erros] falha na análise:', erro);
    r = null;
  }
  entrada.mapa.set(chave, r);
  return r;
}

/** Remove a marcação Markdown de código (`x`) para mostrar como texto simples. */
const textoSimples = (s) => s.replace(/`` (.+?) ``/g, '$1').replace(/`([^`]*)`/g, '$1');

const expandirTabs = (s) => s.replace(/\t/g, '    ');

/** Linha do código com ^^^ embaixo do ponto exato. */
function trechoMarcado(documento, local) {
  const texto = documento.lineAt(local.linha).text;
  const fim = Math.max(local.fimCol ?? local.col + 1, local.col + 1);
  const ini = expandirTabs(texto.slice(0, local.col)).length;
  const tam = Math.max(1, expandirTabs(texto.slice(local.col, fim)).length);
  const num = String(local.linha + 1);
  return `${num} | ${expandirTabs(texto)}\n${' '.repeat(num.length)} | ${' '.repeat(ini)}${'^'.repeat(tam)}`;
}

/** Como a linha fica depois da correção (só para correções numa linha só). */
function linhaCorrigida(documento, c) {
  if (c.linha !== c.fimLinha || c.texto.includes('\n') || c.linha >= documento.lineCount) return null;
  const t = documento.lineAt(c.linha).text;
  return t.slice(0, c.col) + c.texto + t.slice(c.fimCol);
}

/** Nomes de palavras-chave/funções relacionadas ao erro, para mostrar a referência da MDN. */
function referenciasDoErro(d, analise) {
  const nomes = [...(analise?.refs ?? [])];
  const sugestao = /Did you mean ['"](.+?)['"]\?/.exec(d.message);
  if (sugestao) nomes.push(sugestao[1]);
  if (/\bawait\b/.test(d.message)) nomes.push('await', 'async');
  return nomes;
}

function adicionarReferencias(md, nomes) {
  const vistos = new Set();
  for (const nome of nomes) {
    const ref = buscarReferencia(nome);
    if (!ref || vistos.has(ref.nome)) continue;
    vistos.add(ref.nome);
    md.appendMarkdown(`\n\n📖 **\`${ref.nome}\`** — ${ref.resumo}`);
    md.appendCodeblock(ref.exemplo, 'javascript');
    md.appendMarkdown(`[Ver na documentação (MDN)](${ref.url})`);
    if (vistos.size >= 2) break;
  }
}

// ---------------------------------------------------------------- hover

function diagnosticosNaPosicao(documento, posicao) {
  return vscode.languages.getDiagnostics(documento.uri).filter((d) =>
    d.range.contains(posicao) || (d.range.isEmpty && d.range.start.line === posicao.line));
}

async function criarHover(documento, posicao) {
  if (!config().get('ativado')) return null;
  const diagnosticos = diagnosticosNaPosicao(documento, posicao);
  if (!diagnosticos.length) return null;

  const md = new vscode.MarkdownString();
  const mostrarVocabulario = config().get('mostrarVocabulario');
  const mostrarReferencia = config().get('mostrarReferencia') && LINGUAGENS_JS.has(documento.languageId);
  const causasMostradas = new Set();
  const referencias = [];

  for (const [n, d] of diagnosticos.entries()) {
    if (n > 0) md.appendMarkdown('\n\n---\n\n');
    const sev = d.severity ?? 0;
    md.appendMarkdown(`${ICONES[sev]} **${NOMES[sev]}**`);
    if (d.source) md.appendText(` (${d.source})`);
    md.appendText(` · linha ${d.range.start.line + 1}, coluna ${d.range.start.character + 1}`);

    const a = analisarDiagnostico(documento, d);
    if (a) {
      referencias.push(...referenciasDoErro(d, a));
      if (causasMostradas.has(a.causa)) {
        md.appendMarkdown('\n\n↪️ _Mesma causa do erro acima — corrigindo aquele, este some também._');
      } else {
        causasMostradas.add(a.causa);
        if (a.consequencia) md.appendMarkdown('\n\n↪️ _Este erro é consequência de outro problema nesta linha:_');
        md.appendMarkdown(`\n\n🎯 **Causa provável:** ${a.causa}`);
        if (a.local) {
          const mesmoLugar = a.local.linha === d.range.start.line && a.local.col === d.range.start.character;
          md.appendMarkdown(`\n\n📍 **Onde corrigir:** linha ${a.local.linha + 1}, coluna ${a.local.col + 1}`);
          if (!mesmoLugar) md.appendMarkdown(' _(não é exatamente onde o editor sublinhou)_');
          md.appendCodeblock(trechoMarcado(documento, a.local), 'text');
        }
        if (a.dica) md.appendMarkdown(`\n\n💡 ${a.dica}`);
        if (a.correcao) {
          const corrigida = linhaCorrigida(documento, a.correcao);
          md.appendMarkdown(`\n\n✅ **Correção:** ${a.correcao.titulo} — clique na lâmpada 💡 ou use \`Ctrl+.\``);
          if (corrigida !== null) md.appendCodeblock(corrigida.trim(), 'javascript');
        }
        if (a.exemplo) {
          md.appendMarkdown('\n\n✍️ **Exemplo:**');
          md.appendCodeblock(a.exemplo, 'javascript');
        }
      }
    } else {
      referencias.push(...referenciasDoErro(d, null));
    }

    md.appendMarkdown('\n\n🇺🇸 ');
    md.appendText(d.message);

    const t = await traduzir(d.message);
    md.appendMarkdown(a ? '\n\n🇧🇷 _Tradução literal:_ ' : '\n\n🇧🇷 ');
    if (t) {
      md.appendMarkdown(a ? '' : '**');
      md.appendText(t.texto);
      md.appendMarkdown(`${a ? '' : '**'}\n\n_fonte: ${t.fonte}_`);
    } else {
      md.appendMarkdown('_(sem tradução disponível — ative a tradução online nas configurações)_');
    }

    if (mostrarVocabulario) {
      const vocab = encontrarVocabulario(d.message);
      if (vocab.length) {
        md.appendMarkdown('\n\n📚 **Vocabulário:** ');
        md.appendMarkdown(vocab.map(([en, pt]) => `\`${en}\` = ${pt}`).join(' · '));
      }
    }
  }
  if (mostrarReferencia && referencias.length) {
    md.appendMarkdown('\n\n---');
    adicionarReferencias(md, referencias);
  }
  return new vscode.Hover(md);
}

// ---------------------------------------------------------------- correção rápida (lâmpada / Ctrl+.)

function criarCorrecoes(documento, _range, contexto) {
  if (!config().get('ativado')) return [];
  const acoes = [];
  const titulos = new Set();
  for (const d of contexto.diagnostics) {
    const a = analisarDiagnostico(documento, d);
    if (!a || !a.correcao) continue;
    const c = a.correcao;
    if (titulos.has(c.titulo)) continue;
    titulos.add(c.titulo);
    const acao = new vscode.CodeAction(`🇧🇷 ${c.titulo}`, vscode.CodeActionKind.QuickFix);
    acao.edit = new vscode.WorkspaceEdit();
    acao.edit.replace(documento.uri, new vscode.Range(c.linha, c.col, c.fimLinha, c.fimCol), c.texto);
    acao.diagnostics = [d];
    acao.isPreferred = true;
    acoes.push(acao);
  }
  return acoes;
}

// ---------------------------------------------------------------- texto no fim da linha

async function atualizarEditor(editor) {
  if (!editor) return;
  const cfg = config();
  if (!cfg.get('ativado') || !cfg.get('mostrarNaLinha')) {
    editor.setDecorations(decoracao, []);
    editor.setDecorations(decoracaoLocal, []);
    return;
  }

  const limite = NIVEIS[cfg.get('severidadeNaLinha')] ?? 1;
  const documento = editor.document;
  const versao = documento.version;

  // Um diagnóstico por linha: o mais grave (dando preferência aos que têm a causa identificada).
  const porLinha = new Map();
  for (const d of vscode.languages.getDiagnostics(documento.uri)) {
    if ((d.severity ?? 0) > limite) continue;
    const linha = d.range.start.line;
    const analise = analisarDiagnostico(documento, d);
    const atual = porLinha.get(linha);
    const melhor = !atual
      || (analise && !atual.analise)
      || (!!analise === !!atual.analise && (d.severity ?? 0) < (atual.d.severity ?? 0));
    if (melhor) porLinha.set(linha, { d, analise });
  }

  const decoracoes = [];
  const marcadores = [];
  const linhasComTexto = new Set();
  const apontamentos = []; // causa em outra linha: mostra "o erro está aqui" nela
  for (const [linha, { d, analise }] of porLinha) {
    if (linha >= documento.lineCount) continue;
    let texto;
    if (analise) {
      texto = `🎯 ${textoSimples(analise.causa)}`;
      if (analise.local) {
        const { linha: l, col, fimCol } = analise.local;
        marcadores.push({ range: new vscode.Range(l, col, l, Math.max(fimCol ?? col + 1, col + 1)) });
        if (l !== linha) apontamentos.push({ linha: l, origem: linha, d });
      }
    } else {
      const t = await traduzir(d.message);
      if (!t) continue;
      texto = `🇧🇷 ${t.texto}`;
    }
    texto = texto.replace(/\s*\n\s*/g, ' ');
    if (texto.length > 160) texto = texto.slice(0, 157) + '...';
    const fim = documento.lineAt(linha).range.end;
    linhasComTexto.add(linha);
    decoracoes.push({
      range: new vscode.Range(fim, fim),
      renderOptions: {
        after: { contentText: texto, color: new vscode.ThemeColor(CORES[d.severity ?? 0]) },
      },
    });
  }
  for (const { linha, origem, d } of apontamentos) {
    if (linhasComTexto.has(linha)) continue;
    linhasComTexto.add(linha);
    const fim = documento.lineAt(linha).range.end;
    decoracoes.push({
      range: new vscode.Range(fim, fim),
      renderOptions: {
        after: { contentText: `⬅ 🎯 o problema está aqui (erro apontado na linha ${origem + 1})`, color: new vscode.ThemeColor(CORES[d.severity ?? 0]) },
      },
    });
  }

  // Se o documento mudou enquanto traduzíamos, a próxima atualização cuida disso.
  if (documento.version !== versao) return;
  editor.setDecorations(decoracao, decoracoes);
  editor.setDecorations(decoracaoLocal, marcadores);
}

function agendarAtualizacao() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    for (const editor of vscode.window.visibleTextEditors) atualizarEditor(editor);
  }, 300);
}

// ---------------------------------------------------------------- comandos

async function listarErros() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('Abra um arquivo para listar os erros.');
    return;
  }
  const diagnosticos = vscode.languages.getDiagnostics(editor.document.uri);
  canalSaida.clear();
  canalSaida.appendLine(`Erros e sugestões em ${vscode.workspace.asRelativePath(editor.document.uri)} (${diagnosticos.length})`);
  canalSaida.appendLine('='.repeat(60));
  const causasMostradas = new Set();
  for (const d of diagnosticos) {
    const sev = d.severity ?? 0;
    const t = await traduzir(d.message);
    const a = analisarDiagnostico(editor.document, d);
    canalSaida.appendLine('');
    canalSaida.appendLine(`${ICONES[sev]} ${NOMES[sev]} — linha ${d.range.start.line + 1}, coluna ${d.range.start.character + 1}${d.source ? ` (${d.source})` : ''}`);
    if (a && causasMostradas.has(a.causa)) {
      canalSaida.appendLine('   ↪️ Mesma causa de um erro listado acima.');
    } else if (a) {
      causasMostradas.add(a.causa);
      canalSaida.appendLine(`   🎯 ${textoSimples(a.causa)}`);
      if (a.local) {
        canalSaida.appendLine(`   📍 Onde corrigir: linha ${a.local.linha + 1}, coluna ${a.local.col + 1}`);
        canalSaida.appendLine(trechoMarcado(editor.document, a.local).replace(/^/gm, '      '));
      }
      if (a.dica) canalSaida.appendLine(`   💡 ${textoSimples(a.dica)}`);
      if (a.correcao) canalSaida.appendLine(`   ✅ ${a.correcao.titulo} (Ctrl+. na linha do erro)`);
    }
    canalSaida.appendLine(`   🇺🇸 ${d.message.replace(/\n/g, '\n      ')}`);
    canalSaida.appendLine(`   🇧🇷 ${t ? t.texto.replace(/\n/g, '\n      ') : '(sem tradução disponível)'}`);
  }
  canalSaida.show(true);
}

// ---------------------------------------------------------------- explicação de erro copiado / do terminal

const ESQUEMA = 'tradutor-erros';
const explicacoes = new Map();   // uri do documento virtual -> markdown
let contadorExplicacoes = 0;
const EXTENSOES_JS = /\.(?:[cm]?jsx?|tsx?)$/i;

const emCodigo = (s) => (String(s).includes('`') ? '`` ' + s + ' ``' : '`' + s + '`');

/** Acha no disco/workspace o arquivo citado no erro (caminho absoluto, relativo, file:// ou http://localhost/...). */
async function resolverArquivo(caminho) {
  if (!caminho) return null;
  try {
    if (/^file:\/\//i.test(caminho)) caminho = fileURLToPath(caminho);
  } catch { /* segue com o texto original */ }
  if (path.isAbsolute(caminho) && fs.existsSync(caminho)) return vscode.Uri.file(caminho);

  let relativo = caminho;
  if (/^https?:\/\//i.test(caminho)) {
    try { relativo = decodeURIComponent(new URL(caminho).pathname); } catch { return null; }
  }
  relativo = relativo.replace(/^[\\/]+/, '').replace(/\\/g, '/');
  for (const pasta of vscode.workspace.workspaceFolders ?? []) {
    const candidato = path.join(pasta.uri.fsPath, relativo);
    if (fs.existsSync(candidato)) return vscode.Uri.file(candidato);
  }
  // Procura no workspace pelo final do caminho e, por último, só pelo nome do arquivo.
  // Com tempo limite: a busca do editor pode demorar (ou nunca responder) em pastas grandes.
  for (const padrao of [`**/${relativo}`, `**/${path.basename(relativo)}`]) {
    const cancelar = new vscode.CancellationTokenSource();
    try {
      const busca = vscode.workspace.findFiles(padrao, '**/node_modules/**', 2, cancelar.token);
      const limite = new Promise((resolve) => setTimeout(() => resolve([]), 3000));
      const achados = await Promise.race([busca, limite]);
      if (achados.length) return achados[0];
    } catch { /* padrão inválido */ } finally {
      cancelar.cancel();
      cancelar.dispose();
    }
  }
  return null;
}

/** Monta o texto (Markdown) da explicação de um erro colado. */
async function montarExplicacao(textoErro) {
  const info = interpretarErro(textoErro);
  if (!info.principal) return null;

  const partes = [];
  const add = (...l) => partes.push(...l);
  const t = await traduzir(info.principal);
  add(`# 🔴 ${emCodigo(info.principal)}`, '');
  add(`🇧🇷 **${t ? t.texto.replace(/\n/g, ' ') : 'Sem tradução no dicionário (ative a tradução online nas configurações).'}**`, '');
  if (info.tipo && TIPOS_DE_ERRO[info.tipo]) add(`**Tipo de erro:** ${emCodigo(info.tipo)} — ${TIPOS_DE_ERRO[info.tipo]}`, '');

  // Local: abre o arquivo, acha a coluna exata e roda o analisador de causa (JS/TS).
  let arquivo = null;
  let alvo = null;     // { linha, col, fimCol } (base 0) para selecionar no editor
  let analise = null;
  if (info.local) {
    arquivo = await resolverArquivo(info.local.caminho);
    if (arquivo) {
      const doc = await vscode.workspace.openTextDocument(arquivo);
      const linhaConhecida = info.local.linha !== null && info.local.linha !== undefined;
      const linha = linhaConhecida ? Math.max(0, Math.min(info.local.linha - 1, doc.lineCount - 1)) : 0;
      const textoLinha = doc.lineAt(linha).text;
      const coluna = linhaConhecida ? colunaNoArquivo(info.local, textoLinha) : null;
      const col = coluna ? Math.min(coluna - 1, textoLinha.length) : textoLinha.search(/\S|$/);
      alvo = { linha, col, fimCol: coluna ? col + 1 : textoLinha.length };
      if (EXTENSOES_JS.test(arquivo.fsPath)) {
        try {
          // Erros de módulo olham a pasta e o outro arquivo; os demais, só o código deste arquivo.
          analise = analisarModulo(info, arquivo.fsPath, doc.getText(), linhaConhecida ? linha : null)
            ?? (linhaConhecida ? analisar(doc.getText(), { linha, coluna: col, mensagem: info.principal }) : null);
        } catch (erro) {
          console.error('[Tradutor de Erros] falha na análise:', erro);
        }
      }
      if (analise && analise.local) alvo = analise.local;

      if (analise) {
        add('## 🎯 Causa provável', '', analise.causa, '');
      }
      const nome = vscode.workspace.asRelativePath(arquivo);
      add('## 📍 Onde está o erro', '');
      add(`[${nome}, linha ${alvo.linha + 1}, coluna ${alvo.col + 1}](${arquivo.toString()}#L${alvo.linha + 1})`, '');
      if (linhaConhecida && analise && analise.local && (analise.local.linha !== linha || (coluna && analise.local.col !== col))) {
        add(`_O terminal apontou a linha ${linha + 1}${coluna ? `, coluna ${col + 1}` : ''} (primeiro trecho abaixo): é onde o erro **aconteceu**. O segundo trecho é onde ele precisa ser **corrigido**._`, '');
        add('```text', trechoMarcado(doc, { linha, col, fimCol: coluna ? col + 1 : doc.lineAt(linha).text.length }), '```', '');
      }
      add('```text', trechoMarcado(doc, alvo), '```', '');
      if (analise && analise.dica) add(`💡 ${analise.dica}`, '');
      if (analise && analise.correcao) {
        const corrigida = linhaCorrigida(doc, analise.correcao);
        add(`✅ **Correção:** ${analise.correcao.titulo}${corrigida !== null ? ':' : ''}`, '');
        if (corrigida !== null) add('```javascript', corrigida.trim(), '```', '');
      }
      if (analise && analise.exemplo) add('✍️ **Exemplo:**', '', '```javascript', analise.exemplo, '```', '');

      // Caminho das chamadas no código do usuário (ex.: rota -> controller -> model)
      const outras = (info.chamadas ?? []).filter((c) => !(c.linha === info.local.linha && c.caminho === info.local.caminho)).slice(0, 5);
      if (outras.length) {
        add('**Chamado por** (de dentro para fora):', '');
        for (const c of outras) {
          const uri = await resolverArquivo(c.caminho);
          const rotulo = `${uri ? vscode.workspace.asRelativePath(uri) : c.caminho}:${c.linha}`;
          add(`- ${c.funcao ? emCodigo(c.funcao) + ' em ' : ''}${uri ? `[${rotulo}](${uri.toString()}#L${c.linha})` : emCodigo(rotulo)}`);
        }
        add('');
      }
    } else {
      add('## 📍 Onde está o erro', '');
      add(`${emCodigo(info.local.caminho)}, linha ${info.local.linha}${info.local.coluna ? `, coluna ${info.local.coluna}` : ''} _(arquivo não encontrado nesta pasta de trabalho)_`, '');
    }
  }

  if (info.mensagens.length > 1) {
    add('## Outras mensagens no texto', '');
    for (const m of info.mensagens.slice(1, 4)) {
      const tm = await traduzir(m);
      add(`- ${emCodigo(m)}${tm ? ` — ${tm.texto.replace(/\n/g, ' ')}` : ''}`);
    }
    add('');
  }

  if (config().get('mostrarReferencia')) {
    const nomes = referenciasDoErro({ message: info.principal }, analise);
    const vistos = new Set();
    for (const n of nomes) {
      const ref = buscarReferencia(n);
      if (!ref || vistos.has(ref.nome)) continue;
      if (!vistos.size) add('## 📖 Referência', '');
      vistos.add(ref.nome);
      add(`**${emCodigo(ref.nome)}** — ${ref.resumo}`, '', '```javascript', ref.exemplo, '```', `[Ver na documentação (MDN)](${ref.url})`, '');
      if (vistos.size >= 2) break;
    }
  }

  add('## 🇺🇸 Erro original', '', '```text', limparTexto(textoErro).trim().split('\n').slice(0, 40).join('\n'), '```');
  return { markdown: partes.join('\n'), arquivo, alvo, analise, info };
}

/** Mostra a explicação: abre o arquivo no ponto do erro e a explicação ao lado. */
async function mostrarExplicacao(textoErro) {
  const r = await montarExplicacao(textoErro);
  if (!r) {
    vscode.window.showWarningMessage('Tradutor de Erros: não encontrei uma mensagem de erro nesse texto.');
    return null;
  }
  if (r.arquivo && r.alvo) {
    const doc = await vscode.workspace.openTextDocument(r.arquivo);
    const intervalo = new vscode.Range(r.alvo.linha, r.alvo.col, r.alvo.linha, Math.max(r.alvo.fimCol ?? r.alvo.col + 1, r.alvo.col + 1));
    const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, selection: intervalo, preview: false });
    editor.revealRange(intervalo, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }
  const uri = vscode.Uri.from({ scheme: ESQUEMA, path: '/Explicação do erro.md', query: String(++contadorExplicacoes) });
  explicacoes.set(uri.toString(), r.markdown);
  if (explicacoes.size > 20) explicacoes.delete(explicacoes.keys().next().value);
  try {
    await vscode.commands.executeCommand(r.arquivo ? 'markdown.showPreviewToSide' : 'markdown.showPreview', uri);
  } catch {
    // Editor sem a pré-visualização de Markdown: mostra o texto mesmo.
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: true });
  }
  r.uri = uri;
  return r;
}

async function traduzirErroCopiado(textoRecebido) {
  let texto = typeof textoRecebido === 'string' ? textoRecebido : await vscode.env.clipboard.readText();
  if (!texto || !pareceErro(texto)) {
    texto = await vscode.window.showInputBox({
      title: 'Tradutor de Erros: traduzir erro',
      prompt: 'Cole aqui a mensagem de erro (do terminal, do console do navegador...). Dica: copie o erro inteiro, com as linhas "at ..." ou "File ...", para eu achar o local exato.',
      placeHolder: "Ex.: TypeError: Cannot read properties of undefined (reading 'map')",
      value: texto && texto.length < 300 ? texto.trim() : '',
      ignoreFocusOut: true,
    });
    if (!texto) return null;
  }
  return mostrarExplicacao(texto);
}

async function traduzirSelecaoDoTerminal() {
  // VS Code recente expõe a seleção direto; nos antigos, copia e lê da área de transferência.
  let selecao = vscode.window.activeTerminal?.selection;
  if (typeof selecao !== 'string') {
    const anterior = await vscode.env.clipboard.readText();
    await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
    selecao = await vscode.env.clipboard.readText();
    await vscode.env.clipboard.writeText(anterior);
  }
  if (!selecao || !selecao.trim()) {
    vscode.window.showInformationMessage('Selecione o erro no terminal antes (arraste com o mouse).');
    return null;
  }
  return mostrarExplicacao(selecao);
}

// ---- links no terminal + saída recente de cada terminal (para achar arquivo/linha do erro)

const saidasDoTerminal = new Map(); // terminal -> [{ texto }] (últimas execuções)

function guardarSaida(terminal, execucao, pedaco) {
  execucao.texto += limparTexto(pedaco);
  if (execucao.texto.length > 200_000) execucao.texto = execucao.texto.slice(-100_000);
  let lista = saidasDoTerminal.get(terminal);
  if (!lista) saidasDoTerminal.set(terminal, (lista = []));
  if (!lista.includes(execucao)) {
    lista.push(execucao);
    if (lista.length > 5) lista.shift();
  }
}

/** Recorta o texto ao redor da última ocorrência da linha de erro (inclui o "arquivo:linha" acima e a pilha abaixo). */
function recortarAoRedor(texto, linhaDeErro) {
  const alvo = limparTexto(linhaDeErro).trim();
  const linhas = limparTexto(texto).split('\n');
  for (let k = linhas.length - 1; k >= 0; k--) {
    if (linhas[k].includes(alvo)) return linhas.slice(Math.max(0, k - 30), k + 25).join('\n');
  }
  return null;
}

/** Pega o trecho da saída do terminal ao redor da linha de erro, a partir do que foi capturado. */
function contextoDoTerminal(terminal, linhaDeErro) {
  const lista = saidasDoTerminal.get(terminal) ?? [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const trecho = recortarAoRedor(lista[i].texto, linhaDeErro);
    if (trecho) return trecho;
  }
  return null;
}

/**
 * Sem integração de shell (ex.: Windows PowerShell 5.1), lê o conteúdo visível do terminal:
 * seleciona tudo, copia, devolve a área de transferência como estava e limpa a seleção.
 */
async function lerConteudoDoTerminal(terminal) {
  const terminalAntes = vscode.window.activeTerminal;
  let anterior = null;
  try {
    if (terminal && terminalAntes !== terminal) terminal.show(true);
    anterior = await vscode.env.clipboard.readText();
    // Marcador: se depois da cópia ele ainda estiver lá, a cópia falhou.
    const marcador = `tradutor-erros-${Date.now()}-${Math.random()}`;
    await vscode.env.clipboard.writeText(marcador);
    await vscode.commands.executeCommand('workbench.action.terminal.selectAll');
    await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
    const conteudo = await vscode.env.clipboard.readText();
    await vscode.commands.executeCommand('workbench.action.terminal.clearSelection');
    return conteudo && conteudo !== marcador ? conteudo : null;
  } catch {
    return null;
  } finally {
    if (anterior !== null) await vscode.env.clipboard.writeText(anterior).then(undefined, () => {});
    if (terminalAntes && terminal && terminalAntes !== terminal) terminalAntes.show(true);
  }
}

const provedorLinksTerminal = {
  provideTerminalLinks(contexto) {
    const cfg = config();
    if (!cfg.get('ativado') || !cfg.get('linksNoTerminal')) return [];
    const linha = contexto.line;
    if (/^\s+at\s/.test(linha)) return [];
    const m = REGEX_CORS.exec(linha) ?? REGEX_LINHA_ERRO.exec(linha);
    if (!m) return [];
    const texto = m[0].trimEnd();
    return [{
      startIndex: m.index,
      length: texto.length,
      tooltip: '🇧🇷 Ver explicação deste erro em português',
      textoErro: texto,
      terminal: contexto.terminal,
    }];
  },
  async handleTerminalLink(link) {
    let contexto = contextoDoTerminal(link.terminal, link.textoErro);
    if (!contexto) {
      const conteudo = await lerConteudoDoTerminal(link.terminal);
      if (conteudo) contexto = recortarAoRedor(conteudo, link.textoErro);
    }
    return mostrarExplicacao(contexto ?? link.textoErro);
  },
};

async function alternarLinha() {
  const atual = config().get('mostrarNaLinha');
  await config().update('mostrarNaLinha', !atual, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`Tradução no fim da linha ${!atual ? 'ativada' : 'desativada'}.`);
}

// ---------------------------------------------------------------- ativação

function activate(context) {
  decoracao = vscode.window.createTextEditorDecorationType({
    after: { margin: '0 0 0 2em', fontStyle: 'italic' },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
  // Contorno no ponto exato onde está a causa do erro.
  decoracaoLocal = vscode.window.createTextEditorDecorationType({
    border: '1px solid',
    borderColor: new vscode.ThemeColor('editorError.foreground'),
    borderRadius: '3px',
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
  canalSaida = vscode.window.createOutputChannel('Tradutor de Erros');

  context.subscriptions.push(
    decoracao,
    decoracaoLocal,
    canalSaida,
    vscode.languages.registerHoverProvider('*', { provideHover: criarHover }),
    vscode.languages.registerCodeActionsProvider(
      [...LINGUAGENS_JS].map((language) => ({ language })),
      { provideCodeActions: criarCorrecoes },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
    vscode.workspace.onDidCloseTextDocument((doc) => analises.delete(doc.uri.toString())),
    vscode.workspace.registerTextDocumentContentProvider(ESQUEMA, {
      provideTextDocumentContent: (uri) => explicacoes.get(uri.toString()) ?? '',
    }),
    vscode.commands.registerCommand('tradutorErros.traduzirErroCopiado', traduzirErroCopiado),
    vscode.commands.registerCommand('tradutorErros.traduzirSelecaoTerminal', traduzirSelecaoDoTerminal),
    vscode.window.registerTerminalLinkProvider(provedorLinksTerminal),
    vscode.window.onDidCloseTerminal((t) => saidasDoTerminal.delete(t)),
    vscode.languages.onDidChangeDiagnostics(agendarAtualizacao),
    vscode.window.onDidChangeVisibleTextEditors(agendarAtualizacao),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('tradutorErros')) agendarAtualizacao();
    }),
    vscode.commands.registerCommand('tradutorErros.listar', listarErros),
    vscode.commands.registerCommand('tradutorErros.alternarLinha', alternarLinha),
    vscode.commands.registerCommand('tradutorErros.limparCache', () => {
      cache.clear();
      falhas.clear();
      analises.clear();
      agendarAtualizacao();
      vscode.window.showInformationMessage('Cache de traduções limpo.');
    }),
  );

  // Guarda a saída recente dos terminais (VS Code 1.93+ com integração de shell),
  // para o link do erro saber o arquivo e a linha que aparecem acima/abaixo dele.
  if (typeof vscode.window.onDidStartTerminalShellExecution === 'function') {
    context.subscriptions.push(vscode.window.onDidStartTerminalShellExecution((evento) => {
      const execucao = { texto: '' };
      let fluxo;
      try { fluxo = evento.execution.read(); } catch { return; }
      (async () => {
        try {
          for await (const pedaco of fluxo) guardarSaida(evento.terminal, execucao, pedaco);
        } catch { /* terminal fechado */ }
      })();
    }));
  }

  agendarAtualizacao();

  // Usado pelos testes de integração.
  return { montarExplicacao, mostrarExplicacao, provedorLinksTerminal, contextoDoTerminal, explicacoes };
}

function deactivate() {
  clearTimeout(temporizador);
}

module.exports = { activate, deactivate };
