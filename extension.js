const vscode = require('vscode');
const { traduzirLocal, encontrarVocabulario } = require('./tradutor');

const cache = new Map();        // mensagem -> { texto, fonte }
const falhas = new Map();       // mensagem -> horário da última falha online
const ESPERA_APOS_FALHA = 60_000;

let decoracao;
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

  const pendentes = traduzidas.map((t, i) => (t === null ? i : -1)).filter((i) => i >= 0);
  if (pendentes.length) {
    const ultimaFalha = falhas.get(mensagem);
    if (!config().get('traducaoOnline') || (ultimaFalha && Date.now() - ultimaFalha < ESPERA_APOS_FALHA)) return null;
    const textoPendente = pendentes.map((i) => linhas[i]).join('\n');
    const online = await traduzirOnline(textoPendente);
    if (!online) {
      falhas.set(mensagem, Date.now());
      return null;
    }
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

  for (const [n, d] of diagnosticos.entries()) {
    if (n > 0) md.appendMarkdown('\n\n---\n\n');
    const sev = d.severity ?? 0;
    md.appendMarkdown(`${ICONES[sev]} **${NOMES[sev]}**`);
    if (d.source) md.appendText(` (${d.source})`);
    md.appendMarkdown('\n\n🇺🇸 ');
    md.appendText(d.message);

    const t = await traduzir(d.message);
    md.appendMarkdown('\n\n🇧🇷 ');
    if (t) {
      md.appendMarkdown('**');
      md.appendText(t.texto);
      md.appendMarkdown(`**\n\n_fonte: ${t.fonte}_`);
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
  return new vscode.Hover(md);
}

// ---------------------------------------------------------------- texto no fim da linha

async function atualizarEditor(editor) {
  if (!editor) return;
  const cfg = config();
  if (!cfg.get('ativado') || !cfg.get('mostrarNaLinha')) {
    editor.setDecorations(decoracao, []);
    return;
  }

  const limite = NIVEIS[cfg.get('severidadeNaLinha')] ?? 1;
  const documento = editor.document;
  const versao = documento.version;

  // Um diagnóstico por linha: o mais grave.
  const porLinha = new Map();
  for (const d of vscode.languages.getDiagnostics(documento.uri)) {
    if ((d.severity ?? 0) > limite) continue;
    const linha = d.range.start.line;
    const atual = porLinha.get(linha);
    if (!atual || d.severity < atual.severity) porLinha.set(linha, d);
  }

  const decoracoes = [];
  for (const [linha, d] of porLinha) {
    if (linha >= documento.lineCount) continue;
    const t = await traduzir(d.message);
    if (!t) continue;
    let texto = t.texto.replace(/\s*\n\s*/g, ' ');
    if (texto.length > 140) texto = texto.slice(0, 137) + '...';
    const fim = documento.lineAt(linha).range.end;
    decoracoes.push({
      range: new vscode.Range(fim, fim),
      renderOptions: {
        after: { contentText: `🇧🇷 ${texto}`, color: new vscode.ThemeColor(CORES[d.severity ?? 0]) },
      },
    });
  }

  // Se o documento mudou enquanto traduzíamos, a próxima atualização cuida disso.
  if (documento.version !== versao) return;
  editor.setDecorations(decoracao, decoracoes);
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
  for (const d of diagnosticos) {
    const sev = d.severity ?? 0;
    const t = await traduzir(d.message);
    canalSaida.appendLine('');
    canalSaida.appendLine(`${ICONES[sev]} ${NOMES[sev]} — linha ${d.range.start.line + 1}, coluna ${d.range.start.character + 1}${d.source ? ` (${d.source})` : ''}`);
    canalSaida.appendLine(`   🇺🇸 ${d.message.replace(/\n/g, '\n      ')}`);
    canalSaida.appendLine(`   🇧🇷 ${t ? t.texto.replace(/\n/g, '\n      ') : '(sem tradução disponível)'}`);
  }
  canalSaida.show(true);
}

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
  canalSaida = vscode.window.createOutputChannel('Tradutor de Erros');

  context.subscriptions.push(
    decoracao,
    canalSaida,
    vscode.languages.registerHoverProvider('*', { provideHover: criarHover }),
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
      agendarAtualizacao();
      vscode.window.showInformationMessage('Cache de traduções limpo.');
    }),
  );

  agendarAtualizacao();
}

function deactivate() {
  clearTimeout(temporizador);
}

module.exports = { activate, deactivate };
