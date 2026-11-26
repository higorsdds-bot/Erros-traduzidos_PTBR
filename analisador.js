// Analisador de erros de JavaScript/TypeScript.
//
// As mensagens do editor muitas vezes apontam para o lugar errado ou dizem algo enganoso
// (ex.: "';' expected" quando o problema real é "funtion" escrito errado).
// Este módulo lê o código ao redor do erro e tenta descobrir a CAUSA REAL e a posição exata.
//
// Não depende do VS Code: recebe o texto do arquivo e o diagnóstico, devolve:
//   { causa, local: { linha, col, fimCol }, dica?, exemplo?, correcao?, refs: [] }  ou  null
// (linhas e colunas começam em 0, como no VS Code).

const { reservadas, palavrasChave, globais, metodosDoTipo, buscarReferencia } = require('./referencia-js');

// ================================================================ tokenizador

const PONTUACAO = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=',
  '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
const SIMBOLOS = '{}()[];,<>+-*/%&|^!~?:=.@';
const ANTES_DE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>',
  '~', '^', '=>', '&&', '||', '??', '==', '===', '!=', '!==', '+=', '-=', '*=', '/=', 'return', 'typeof', 'case', 'do',
  'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'await', 'yield']);
const ID_INICIO = /[\p{ID_Start}$_#]/u;
const ID_RESTO = /[\p{ID_Continue}$‌‍]/u;

function tokenizar(texto) {
  const toks = [];
  const n = texto.length;
  const pilhaTpl = []; // para cada `${` aberto, quantas `{` normais estão abertas dentro dele
  let i = 0;

  const add = (tipo, ini, fim, extra) => toks.push({ tipo, valor: texto.slice(ini, fim), ini, fim, ...extra });
  const anterior = () => toks[toks.length - 1];

  function lerTemplate(ini) {
    // i aponta para o primeiro caractere depois de ` ou de }
    while (i < n) {
      const c = texto[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; add('tpl', ini, i); return; }
      if (c === '$' && texto[i + 1] === '{') { i += 2; add('tpl', ini, i); pilhaTpl.push(0); return; }
      i++;
    }
    add('tpl', ini, n, { naoFechada: true });
  }

  while (i < n) {
    const c = texto[i];
    if (/\s/.test(c)) { i++; continue; }

    if (c === '/' && texto[i + 1] === '/') { while (i < n && texto[i] !== '\n') i++; continue; }
    if (c === '/' && texto[i + 1] === '*') {
      const fim = texto.indexOf('*/', i + 2);
      i = fim < 0 ? n : fim + 2;
      continue;
    }

    const ini = i;
    if (c === '"' || c === "'") {
      i++;
      while (i < n && texto[i] !== c && texto[i] !== '\n') i += texto[i] === '\\' ? 2 : 1;
      if (i < n && texto[i] === c) { i++; add('str', ini, i); } else add('str', ini, i, { naoFechada: true });
      continue;
    }
    if (c === '`') { i++; lerTemplate(ini); continue; }

    if (c === '}' && pilhaTpl.length && pilhaTpl[pilhaTpl.length - 1] === 0) {
      pilhaTpl.pop();
      i++;
      lerTemplate(ini);
      continue;
    }

    if (/\d/.test(c) || (c === '.' && /\d/.test(texto[i + 1] ?? ''))) {
      const m = /^(0[xXbBoO][\da-fA-F_]+n?|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?n?|\.\d+(?:[eE][+-]?\d+)?)/.exec(texto.slice(i, i + 64));
      i += m ? m[0].length : 1;
      add('num', ini, i);
      continue;
    }

    if (ID_INICIO.test(c)) {
      i++;
      while (i < n && ID_RESTO.test(texto[i])) i++;
      add('id', ini, i);
      continue;
    }

    if (c === '/') {
      const ant = anterior();
      const podeRegex = !ant || (ant.tipo === 'pont' && ANTES_DE_REGEX.has(ant.valor) && ant.valor !== ')' && ant.valor !== ']')
        || (ant.tipo === 'id' && ANTES_DE_REGEX.has(ant.valor));
      if (podeRegex) {
        let j = i + 1;
        let classe = false;
        while (j < n && texto[j] !== '\n') {
          if (texto[j] === '\\') { j += 2; continue; }
          if (texto[j] === '[') classe = true;
          else if (texto[j] === ']') classe = false;
          else if (texto[j] === '/' && !classe) break;
          j++;
        }
        if (j < n && texto[j] === '/') {
          j++;
          while (j < n && /[a-z]/i.test(texto[j])) j++;
          i = j;
          add('regex', ini, i);
          continue;
        }
      }
    }

    const p = PONTUACAO.find((s) => texto.startsWith(s, i));
    if (p) { i += p.length; add('pont', ini, i); continue; }
    if (SIMBOLOS.includes(c)) {
      i++;
      if (pilhaTpl.length) {
        if (c === '{') pilhaTpl[pilhaTpl.length - 1]++;
        else if (c === '}') pilhaTpl[pilhaTpl.length - 1]--;
      }
      add('pont', ini, i);
      continue;
    }

    // Caractere que não existe na linguagem (aspas curvas, travessão etc.).
    const cp = texto.codePointAt(i);
    i += cp > 0xffff ? 2 : 1;
    add('invalido', ini, i);
  }
  return toks;
}

// ================================================================ contexto (texto + tokens + posições)

let ultimoTexto = null;
let ultimoContexto = null;

function criarContexto(texto) {
  if (texto === ultimoTexto) return ultimoContexto;
  const inicioLinhas = [0];
  for (let k = 0; k < texto.length; k++) if (texto[k] === '\n') inicioLinhas.push(k + 1);
  const toks = tokenizar(texto);
  const linhaDe = (pos) => {
    let lo = 0, hi = inicioLinhas.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (inicioLinhas[m] <= pos) lo = m; else hi = m - 1;
    }
    return lo;
  };
  for (const t of toks) {
    t.linha = linhaDe(t.ini);
    t.col = t.ini - inicioLinhas[t.linha];
    t.fimCol = t.col + Math.min(t.fim, fimDaLinha(t.linha)) - t.ini;
  }
  function fimDaLinha(l) {
    const prox = inicioLinhas[l + 1];
    return prox === undefined ? texto.length : prox - 1 - (texto[prox - 2] === '\r' ? 1 : 0);
  }
  const linhas = texto.split(/\r?\n/);
  const ctx = {
    texto, toks, linhas, inicioLinhas,
    offset: (linha, col) => (inicioLinhas[linha] ?? texto.length) + col,
    indentacao: (linha) => /^[ \t]*/.exec(linhas[linha] ?? '')[0].replace(/\t/g, '    ').length,
    primeiroDaLinha: (t) => !toks.some((o) => o.linha === t.linha && o.ini < t.ini),
    // índice do token na posição (ou o primeiro depois dela)
    indiceEm(pos) {
      let lo = 0, hi = toks.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (toks[m].fim <= pos) lo = m + 1; else hi = m;
      }
      return lo;
    },
    delimitadores: null,
    contagemIds: null,
  };
  ultimoTexto = texto;
  ultimoContexto = ctx;
  return ctx;
}

const ABRE = { '(': ')', '[': ']', '{': '}' };
const FECHA = { ')': '(', ']': '[', '}': '{' };
const ehAbre = (t) => t && t.tipo === 'pont' && t.valor in ABRE;
const ehFecha = (t) => t && t.tipo === 'pont' && t.valor in FECHA;

function abrePar(ctx, idxFecha) {
  const { toks } = ctx;
  let prof = 0;
  for (let j = idxFecha; j >= 0; j--) {
    if (ehFecha(toks[j])) prof++;
    else if (ehAbre(toks[j]) && --prof === 0) return j;
  }
  return -1;
}

function fechaPar(ctx, idxAbre) {
  const { toks } = ctx;
  let prof = 0;
  for (let j = idxAbre; j < toks.length; j++) {
    if (ehAbre(toks[j])) prof++;
    else if (ehFecha(toks[j]) && --prof === 0) return j;
  }
  return -1;
}

// ================================================================ utilidades

/** Distância de edição (Damerau/OSA): conta trocas de letras vizinhas como 1. */
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Procura na lista a palavra mais parecida (ou null se nenhuma for parecida o bastante). */
function maisParecida(palavra, lista) {
  const p = palavra.toLowerCase();
  let melhor = null;
  let melhorD = Infinity;
  for (const alvo of lista) {
    if (alvo === palavra) return null;
    if (alvo.toLowerCase() === p) return alvo; // só diferença de maiúscula/minúscula
    const d = distancia(p, alvo.toLowerCase());
    const limite = alvo.length <= 3 ? 1 : alvo.length <= 5 ? 1 : 2;
    if (d > limite) continue;
    // Palavras de 3 letras: só aceita letras trocadas de lugar ("fro" -> "for") ou uma letra faltando ("lg" -> "log").
    if (alvo.length <= 3 && p.length === alvo.length && [...p].sort().join('') !== [...alvo.toLowerCase()].sort().join('')) continue;
    if (p.length < 2) continue;
    if (d < melhorD) { melhor = alvo; melhorD = d; }
  }
  return melhor;
}

const codigo = (s) => (String(s).includes('`') ? '`` ' + s + ' ``' : '`' + s + '`');
const localDe = (t) => ({ linha: t.linha, col: t.col, fimCol: t.fimCol });
const ehExpressaoFim = (t) => t && (t.tipo === 'num' || t.tipo === 'str' || t.tipo === 'tpl' || t.tipo === 'regex'
  || (t.tipo === 'id' && !reservadas.includes(t.valor)) || ['true', 'false', 'null', 'this'].includes(t.valor)
  || (t.tipo === 'pont' && (t.valor === ')' || t.valor === ']')));
const ehExpressaoInicio = (t) => t && (t.tipo === 'num' || t.tipo === 'str' || t.tipo === 'tpl'
  || (t.tipo === 'id' && !['of', 'in', 'instanceof', 'as', 'from'].includes(t.valor)));

function contarIds(ctx) {
  if (!ctx.contagemIds) {
    ctx.contagemIds = new Map();
    for (const t of ctx.toks) if (t.tipo === 'id') ctx.contagemIds.set(t.valor, (ctx.contagemIds.get(t.valor) ?? 0) + 1);
  }
  return ctx.contagemIds;
}

function foiDeclarado(ctx, nome) {
  const esc = nome.replace(/[$]/g, '\\$');
  return new RegExp(`\\b(?:const|let|var|function|class|import)\\s+(?:\\{[^}]*)?\\b${esc}\\b|\\b${esc}\\s*(?:=>|=[^=>])|[(,]\\s*${esc}\\s*[,)=]`).test(ctx.texto);
}

// ================================================================ análise: delimitadores ( ) [ ] { }

/**
 * Percorre o arquivo casando ( [ { com ) ] }. Devolve a lista de problemas:
 *  - { tipo: 'naoFechado', abre, antes }  -> `abre` nunca foi fechado (antes = token onde percebemos)
 *  - { tipo: 'sobrando', fecha }          -> `fecha` não tem abertura correspondente
 */
function analisarDelimitadores(ctx) {
  if (ctx.delimitadores) return ctx.delimitadores;
  const { toks } = ctx;
  const pilha = [];
  const problemas = [];
  const suspeitos = []; // blocos { que, pela indentação, parecem não ter sido fechados
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.tipo !== 'pont') continue;
    if (t.valor in ABRE) {
      const ant = toks[k - 1];
      pilha.push({ tok: t, ehFor: t.valor === '(' && ant && ant.valor === 'for' });
      continue;
    }
    if (t.valor === ';') {
      // ";" dentro de ( ) ou [ ] (fora do for) quase sempre é um ) ou ] que ficou faltando.
      const topo = pilha[pilha.length - 1];
      if (topo && ((topo.tok.valor === '(' && !topo.ehFor) || topo.tok.valor === '[')) {
        problemas.push({ tipo: 'naoFechado', abre: topo.tok, antes: t });
        pilha.pop();
      }
      continue;
    }
    if (!(t.valor in FECHA)) continue;
    const esperado = FECHA[t.valor];
    let pos = -1;
    for (let j = pilha.length - 1; j >= 0; j--) if (pilha[j].tok.valor === esperado) { pos = j; break; }
    if (pos < 0) { problemas.push({ tipo: 'sobrando', fecha: t }); continue; }

    if (pos === pilha.length - 1 && t.valor === '}' && ctx.primeiroDaLinha(t)) {
      // Indentação: um } no começo da linha deveria estar alinhado com a linha que abriu o bloco.
      const indFecha = ctx.indentacao(t.linha);
      const indAbre = ctx.indentacao(pilha[pos].tok.linha);
      if (indFecha < indAbre) {
        for (let j = pos - 1; j >= 0; j--) {
          if (pilha[j].tok.valor === '{' && ctx.indentacao(pilha[j].tok.linha) === indFecha) {
            suspeitos.push({ tipo: 'naoFechado', abre: pilha[pos].tok, antes: t, porIndentacao: true });
            break;
          }
        }
      }
    }
    for (let j = pilha.length - 1; j > pos; j--) problemas.push({ tipo: 'naoFechado', abre: pilha[j].tok, antes: t });
    pilha.length = pos;
  }
  for (const p of pilha) problemas.push({ tipo: 'naoFechado', abre: p.tok, antes: null });

  // Só confia na indentação quando as chaves realmente não fecham.
  const chavesAbertas = problemas.filter((p) => p.tipo === 'naoFechado' && p.abre.valor === '{').length;
  const chavesSobrando = problemas.filter((p) => p.tipo === 'sobrando' && p.fecha.valor === '}').length;
  if (chavesAbertas !== chavesSobrando && suspeitos.length) {
    const s = suspeitos[0];
    const resto = problemas.filter((p) => !(p.tipo === 'naoFechado' && p.abre.valor === '{' && p.antes === null));
    problemas.length = 0;
    problemas.push(s, ...resto);
  }
  ctx.delimitadores = problemas;
  return problemas;
}

// [artigo, nome, aberto/aberta, fechado/fechada]
const NOME_DELIM = {
  '(': ['O', 'parêntese', 'aberto', 'fechado'],
  '[': ['O', 'colchete', 'aberto', 'fechado'],
  '{': ['A', 'chave', 'aberta', 'fechada'],
};

function descreverNaoFechado(ctx, p) {
  const a = p.abre;
  const fecha = ABRE[a.valor];
  const [art, nome, aberto, fechado] = NOME_DELIM[a.valor];
  const trecho = (ctx.linhas[a.linha] ?? '').trim();
  const r = {
    causa: `${art} ${nome} ${codigo(a.valor)} ${aberto} na linha ${a.linha + 1}, coluna ${a.col + 1} nunca foi ${fechado}: falta ${codigo(fecha)}.`,
    local: localDe(a),
    refs: [],
  };
  if (a.valor === '{') {
    r.dica = `Bloco aberto em: ${codigo(trecho.length > 60 ? trecho.slice(0, 57) + '...' : trecho)}. ` +
      (p.porIndentacao
        ? `Pela indentação, o ${codigo('}')} da linha ${p.antes.linha + 1} fecha outro bloco — o ${codigo('}')} deste bloco deveria vir antes dele.`
        : `Adicione ${codigo('}')} no fim do bloco.`);
    if (p.porIndentacao && p.antes) {
      const ind = ' '.repeat(ctx.indentacao(a.linha));
      r.correcao = { titulo: `Inserir "}" para fechar o bloco da linha ${a.linha + 1}`, linha: p.antes.linha, col: 0, fimLinha: p.antes.linha, fimCol: 0, texto: ind + '}\n' };
    }
  } else if (p.antes && p.antes.valor === ';') {
    r.causa = `${art} ${nome} ${codigo(a.valor)} ${aberto} na coluna ${a.col + 1} da linha ${a.linha + 1} não foi ${fechado} antes do ${codigo(';')}: falta ${codigo(fecha)}.`;
    r.correcao = { titulo: `Inserir "${fecha}" antes do ";"`, linha: p.antes.linha, col: p.antes.col, fimLinha: p.antes.linha, fimCol: p.antes.col, texto: fecha };
  } else if (p.antes && a.valor === '(' && p.antes.valor === '{') {
    // if (x > 0 {  -> falta ) antes da {
    const ultimo = ctx.toks[ctx.indiceEm(p.antes.ini) - 1];
    r.dica = `Feche o parêntese antes da ${codigo('{')}: ${codigo(ctx.texto.slice(ctx.offset(a.linha, 0) + /^\s*/.exec(ctx.linhas[a.linha])[0].length, ultimo.fim) + ') {')}`;
    r.correcao = { titulo: 'Inserir ")" antes da "{"', linha: ultimo.linha, col: ultimo.fimCol, fimLinha: ultimo.linha, fimCol: ultimo.fimCol, texto: ')' };
  } else if (p.antes) {
    r.dica = `Ele deveria ser fechado antes do ${codigo(p.antes.valor)} da linha ${p.antes.linha + 1}, coluna ${p.antes.col + 1}.`;
  }
  return r;
}

function descreverSobrando(ctx, p) {
  const f = p.fecha;
  return {
    causa: `Este ${codigo(f.valor)} está sobrando: não existe ${codigo(FECHA[f.valor])} aberto para ele fechar.`,
    local: localDe(f),
    dica: f.valor === '}'
      ? 'Provavelmente algum bloco acima foi fechado antes da hora (um } a mais), ou falta o começo do bloco (ex.: o "if (...) {" antes de um "} else {").'
      : `Apague este ${codigo(f.valor)} ou adicione o ${codigo(FECHA[f.valor])} que falta antes dele.`,
    correcao: { titulo: `Remover "${f.valor}" sobrando`, linha: f.linha, col: f.col, fimLinha: f.linha, fimCol: f.fimCol, texto: '' },
    refs: [],
  };
}

// ================================================================ análise: palavra-chave escrita errado

function analisarPalavraChave(ctx, linhas, preferirPos) {
  const { toks } = ctx;
  const contagem = contarIds(ctx);
  const candidatos = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.tipo !== 'id' || !linhas.includes(t.linha)) continue;
    if (reservadas.includes(t.valor) || palavrasChave.includes(t.valor) || globais.includes(t.valor)) continue;
    const ant = toks[k - 1];
    const prox = toks[k + 1];
    if (ant && (ant.valor === '.' || ant.valor === '?.')) continue;
    if (prox && [':', '.', '?.', '=', '+=', '-='].includes(prox.valor)) continue;

    // "elseif", "elif", "elsif"
    if (/^(elseif|elsif|elif|else_if)$/i.test(t.valor)) {
      candidatos.push({ t, sugestao: 'else if', motivo: 'elseif' });
      continue;
    }
    if ((contagem.get(t.valor) ?? 0) >= 3 || foiDeclarado(ctx, t.valor)) continue;
    const sugestao = maisParecida(t.valor, palavrasChave);
    if (!sugestao) continue;
    // Precisa estar numa posição onde só uma palavra-chave faria sentido:
    // seguida de outro nome/valor ("cosnt nome", "retrun 5", "funtion somar") ou de ( / {.
    const contextoOk = ehExpressaoInicio(prox) || (prox && ['(', '{', '['].includes(prox.valor) && prox.linha === t.linha)
      || (prox && prox.linha !== t.linha) || t.ini <= preferirPos && preferirPos < t.fim;
    if (!contextoOk) continue;
    candidatos.push({ t, sugestao, motivo: sugestao.toLowerCase() === t.valor.toLowerCase() ? 'maiuscula' : 'digitacao' });
  }
  if (!candidatos.length) return null;
  // Prefere o candidato no ponto do erro; senão o mais próximo antes dele.
  candidatos.sort((a, b) => {
    const da = a.t.ini <= preferirPos ? preferirPos - a.t.ini : 1e9 + a.t.ini;
    const db = b.t.ini <= preferirPos ? preferirPos - b.t.ini : 1e9 + b.t.ini;
    return da - db;
  });
  const { t, sugestao, motivo } = candidatos[0];
  const causa = motivo === 'maiuscula'
    ? `${codigo(t.valor)} está com letra maiúscula. JavaScript diferencia maiúsculas de minúsculas: o certo é ${codigo(sugestao)}.`
    : motivo === 'elseif'
      ? `${codigo(t.valor)} não existe em JavaScript: o certo é ${codigo('else if')}, separado.`
      : `${codigo(t.valor)} está escrito errado: o certo é ${codigo(sugestao)}.`;
  return {
    causa,
    local: localDe(t),
    dica: 'Os outros erros desta linha são consequência dessa palavra: o editor não a reconhece e se perde no resto da linha.',
    correcao: { titulo: `Trocar "${t.valor}" por "${sugestao}"`, linha: t.linha, col: t.col, fimLinha: t.linha, fimCol: t.fimCol, texto: sugestao },
    refs: [sugestao === 'else if' ? 'else' : sugestao],
  };
}

// ================================================================ análise: await fora de função async

function nomeDaChamada(ctx, k) {
  // k: token logo antes do início da função (deve ser "(" ou ",") -> nome da função chamada.
  const { toks } = ctx;
  let prof = 0;
  for (let j = k; j >= 0; j--) {
    const t = toks[j];
    if (ehFecha(t)) prof++;
    else if (ehAbre(t)) {
      if (prof === 0) {
        if (t.valor !== '(') return null;
        const nome = toks[j - 1];
        return nome && nome.tipo === 'id' ? nome.valor : null;
      }
      prof--;
    } else if (prof === 0 && t.valor === ';') return null;
  }
  return null;
}

/** Descobre a função que envolve o token k. Devolve { inicio, tipo, chamada } ou null (nível do arquivo). */
function funcaoQueEnvolve(ctx, k) {
  const { toks } = ctx;
  let prof = 0;
  let cortado = false;
  for (let j = k - 1; j >= 0; j--) {
    const t = toks[j];
    if (ehFecha(t)) { prof++; continue; }
    if (ehAbre(t)) {
      if (prof > 0) {
        prof--;
        if (prof === 0 && t.valor === '{') cortado = true;
        continue;
      }
      cortado = false;
      if (t.valor !== '{') continue; // estamos dentro de ( ) ou [ ]: continua subindo
      const cab = cabecalhoDeFuncao(ctx, j);
      if (cab) return cab;
      continue;
    }
    if (prof > 0) continue;
    if (t.valor === ';' || t.valor === ',') cortado = true;
    if (t.valor === '=>' && !cortado) return inicioArrow(ctx, j);
  }
  return null;
}

function inicioArrow(ctx, idxSeta) {
  const { toks } = ctx;
  let ini = idxSeta - 1;
  if (toks[ini] && toks[ini].valor === ')') ini = abrePar(ctx, ini);
  if (ini < 0) return null;
  if (toks[ini - 1] && toks[ini - 1].valor === 'async') return { jaAsync: true };
  const ant = toks[ini - 1];
  const chamada = ant && (ant.valor === '(' || ant.valor === ',') ? nomeDaChamada(ctx, ini - 1) : null;
  return { inicio: toks[ini], tipo: 'arrow', chamada };
}

function cabecalhoDeFuncao(ctx, idxChave) {
  const { toks } = ctx;
  const ant = toks[idxChave - 1];
  if (!ant) return null;
  if (ant.valor === '=>') return inicioArrow(ctx, idxChave - 1);
  if (ant.valor !== ')') return null;
  const abre = abrePar(ctx, idxChave - 1);
  const antes = toks[abre - 1];
  if (!antes) return null;
  let ini;
  let tipo = 'funcao';
  if (antes.valor === 'function' || (antes.valor === '*' && toks[abre - 2]?.valor === 'function')) ini = antes.valor === '*' ? abre - 2 : abre - 1;
  else if (antes.tipo === 'id' && toks[abre - 2]?.valor === 'function') ini = abre - 2;
  else if (antes.tipo === 'id' && !['if', 'for', 'while', 'switch', 'catch', 'with'].includes(antes.valor) && toks[abre - 2]?.valor !== '.') {
    ini = abre - 1;
    tipo = 'metodo';
  } else return null;
  if (toks[ini - 1] && toks[ini - 1].valor === 'async') return { jaAsync: true };
  const a = toks[ini - 1];
  const chamada = a && (a.valor === '(' || a.valor === ',') ? nomeDaChamada(ctx, ini - 1) : null;
  return { inicio: toks[ini], tipo, chamada };
}

function analisarAwait(ctx, pos, nivelArquivo) {
  const { toks } = ctx;
  let k = ctx.indiceEm(pos);
  if (!toks[k] || toks[k].valor !== 'await') {
    const alt = toks.findIndex((t) => t.valor === 'await' && t.ini >= pos - 1);
    if (alt < 0) return null;
    k = alt;
  }
  const aw = toks[k];
  const fn = nivelArquivo ? null : funcaoQueEnvolve(ctx, k);
  if (fn && fn.jaAsync) return null;

  if (!fn) {
    return {
      causa: `Este ${codigo('await')} está fora de qualquer função. Num arquivo comum (script), ${codigo('await')} só funciona dentro de uma função ${codigo('async')}.`,
      local: localDe(aw),
      dica: `Coloque o código dentro de uma função async e chame-a, ou transforme o arquivo em módulo (adicione ${codigo('export {}')}, use ${codigo('<script type="module">')} ou ${codigo('"type": "module"')} no package.json).`,
      exemplo: 'async function main() {\n  const resposta = await fetch("/api");\n  // ...\n}\n\nmain();',
      refs: ['await', 'async'],
    };
  }

  const ini = fn.inicio;
  const cabecalho = (ctx.linhas[ini.linha] ?? '').slice(ini.col).trim();
  const trecho = codigo(cabecalho.length > 50 ? cabecalho.slice(0, 47) + '...' : cabecalho);
  const correcao = { titulo: 'Adicionar "async" na função', linha: ini.linha, col: ini.col, fimLinha: ini.linha, fimCol: ini.col, texto: 'async ' };

  if (fn.chamada === 'forEach') {
    return {
      causa: `O ${codigo('await')} está dentro da função passada ao ${codigo('forEach')} (linha ${ini.linha + 1}), e essa função não é ${codigo('async')}.`,
      local: localDe(ini),
      dica: `Mesmo colocando ${codigo('async')} nela, o ${codigo('forEach')} NÃO espera cada item terminar. Troque o forEach por um ${codigo('for...of')}:`,
      exemplo: 'for (const item of lista) {\n  await salvar(item);\n}',
      refs: ['await', 'forEach'],
    };
  }
  if (fn.chamada === 'map' || fn.chamada === 'filter') {
    return {
      causa: `O ${codigo('await')} está dentro da função passada ao ${codigo(fn.chamada)} (linha ${ini.linha + 1}), e essa função não é ${codigo('async')}.`,
      local: localDe(ini),
      dica: `Coloque ${codigo('async')} na função. ${fn.chamada === 'map' ? `O ${codigo('map')} vai devolver uma lista de Promises: use ${codigo('await Promise.all(...)')} para esperar todas.` : `Atenção: ${codigo('filter')} não funciona com funções async (toda Promise conta como "verdadeiro") — use um for...of.`}`,
      exemplo: fn.chamada === 'map'
        ? 'const resultados = await Promise.all(\n  lista.map(async (item) => {\n    return await buscar(item);\n  })\n);'
        : 'const filtrados = [];\nfor (const item of lista) {\n  if (await valido(item)) filtrados.push(item);\n}',
      correcao,
      refs: ['await', fn.chamada === 'map' ? 'Promise.all' : 'for'],
    };
  }
  const onde = fn.chamada ? `a função passada para ${codigo(fn.chamada)} ` : `a função ${trecho} `;
  return {
    causa: `O ${codigo('await')} só pode ser usado dentro de uma função ${codigo('async')}, e ${onde}(linha ${ini.linha + 1}) não é async.`,
    local: localDe(ini),
    dica: `Coloque ${codigo('async')} no começo da função, aqui na linha ${ini.linha + 1}, coluna ${ini.col + 1}. Lembre: uma função async sempre devolve uma Promise, então quem a chama também precisa de ${codigo('await')} (ou ${codigo('.then()')}).`,
    exemplo: fn.tipo === 'arrow'
      ? 'const carregar = async () => {\n  const resposta = await fetch("/api");\n};'
      : fn.tipo === 'metodo'
        ? 'async carregar() {\n  const resposta = await fetch("/api");\n}'
        : 'async function carregar() {\n  const resposta = await fetch("/api");\n}',
    correcao,
    refs: ['async', 'await'],
  };
}

// ================================================================ análises de sintaxe pontuais

const CARACTERES = {
  '“': ['aspas curvas “', '"'], '”': ['aspas curvas ”', '"'], '„': ['aspas curvas „', '"'],
  '‘': ['aspas curvas ‘', "'"], '’': ['aspas curvas ’', "'"], '´': ['acento agudo ´', "'"],
  '–': ['travessão –', '-'], '—': ['travessão —', '-'], '−': ['sinal de menos −', '-'],
  '×': ['sinal de vezes ×', '*'], '÷': ['sinal de divisão ÷', '/'],
  '​': ['espaço invisível (zero-width)', ''], '﻿': ['caractere invisível (BOM)', ''],
  '¨': ['trema ¨', ''], 'º': ['ordinal º', ''], 'ª': ['ordinal ª', ''], '§': ['parágrafo §', ''],
};

function analisarCaractere(ctx, linha) {
  const t = ctx.toks.find((o) => o.tipo === 'invalido' && o.linha === linha);
  if (!t) return null;
  const info = CARACTERES[t.valor];
  const cp = 'U+' + t.valor.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  const r = {
    causa: info
      ? `Caractere inválido: ${info[0]} (${cp}). Ele não existe no JavaScript${info[1] ? `; use ${codigo(info[1])}` : ' — apague-o'}.`
      : `Caractere inválido: ${codigo(t.valor)} (${cp}) não pode aparecer no código fora de strings.`,
    local: localDe(t),
    dica: info && info[1] === '"' || info && info[1] === "'"
      ? 'Isso acontece quando o código é copiado de Word, WhatsApp, PDF ou sites: as aspas viram aspas "curvas". Redigite as aspas no editor.'
      : undefined,
    correcao: info ? { titulo: info[1] ? `Trocar por "${info[1]}"` : 'Apagar caractere', linha: t.linha, col: t.col, fimLinha: t.linha, fimCol: t.fimCol, texto: info[1] } : undefined,
    refs: [],
  };
  return r;
}

function analisarStringAberta(ctx, linha) {
  const t = ctx.toks.find((o) => (o.tipo === 'str' || o.tipo === 'tpl') && o.naoFechada && o.linha <= linha && o.linha >= linha - 1);
  if (!t) return null;
  const aspa = t.valor[0];
  return {
    causa: t.tipo === 'tpl'
      ? `A template string que começa com ${codigo('`')} na linha ${t.linha + 1}, coluna ${t.col + 1} nunca foi fechada: falta a crase ${codigo('`')} no final.`
      : `O texto (string) que começa com ${codigo(aspa)} na coluna ${t.col + 1} não foi fechado nesta linha: falta ${codigo(aspa)} no final do texto.`,
    local: { linha: t.linha, col: t.col, fimCol: t.col + 1 },
    dica: t.tipo === 'tpl' ? undefined : `Strings com ${codigo(aspa)} não podem quebrar linha. Para texto em várias linhas use crase: ${codigo('`linha 1\\nlinha 2`')}. Se o texto tem ${codigo(aspa)} dentro, use a outra aspa por fora ou escape com ${codigo('\\' + aspa)}.`,
    refs: [],
  };
}

function analisarSetaSeparada(ctx, linha) {
  const { toks } = ctx;
  for (let k = 0; k < toks.length - 1; k++) {
    const a = toks[k], b = toks[k + 1];
    if (a.linha !== linha || a.valor !== '=' || b.valor !== '>' || b.ini === a.fim) continue;
    return {
      causa: `A seta da arrow function foi escrita separada (${codigo('= >')}). O certo é ${codigo('=>')}, junto, sem espaço.`,
      local: { linha, col: a.col, fimCol: b.fimCol },
      correcao: { titulo: 'Juntar para "=>"', linha, col: a.col, fimLinha: linha, fimCol: b.fimCol, texto: '=>' },
      refs: ['=>'],
    };
  }
  return null;
}

function analisarCondicaoSemParenteses(ctx, linha) {
  const { toks } = ctx;
  for (let k = 0; k < toks.length - 1; k++) {
    const t = toks[k];
    if (t.linha !== linha || !['if', 'while', 'switch', 'for'].includes(t.valor)) continue;
    const prox = toks[k + 1];
    if (!prox || prox.valor === '(') continue;
    if (t.valor === 'if' && toks[k - 1]?.valor === 'else' && prox.valor === '(') continue;
    let fim = k + 1;
    while (toks[fim] && toks[fim].linha === linha && toks[fim].valor !== '{') fim++;
    const r = {
      causa: `A condição do ${codigo(t.valor)} precisa estar entre parênteses: ${codigo(t.valor + ' (condição) {')}.`,
      local: localDe(t),
      refs: [t.valor === 'else' ? 'if' : t.valor],
    };
    if (toks[fim] && toks[fim].valor === '{' && fim > k + 1) {
      const cond = ctx.texto.slice(prox.ini, toks[fim - 1].fim);
      r.correcao = { titulo: `Colocar a condição entre parênteses`, linha, col: prox.col, fimLinha: linha, fimCol: toks[fim - 1].fimCol, texto: `(${cond})` };
      r.dica = `Fica assim: ${codigo(`${t.valor} (${cond}) {`)}`;
    }
    return r;
  }
  return null;
}

function analisarReservadaComoNome(ctx, linha) {
  const { toks } = ctx;
  for (let k = 0; k < toks.length - 1; k++) {
    const t = toks[k];
    if (t.linha !== linha || !['let', 'const', 'var', 'function', 'class'].includes(t.valor)) continue;
    const nome = toks[k + 1];
    if (nome && nome.tipo === 'id' && reservadas.includes(nome.valor) && !(t.valor === 'let' && nome.valor === 'await')) {
      return {
        causa: `${codigo(nome.valor)} é uma palavra reservada do JavaScript e não pode ser usada como nome de ${t.valor === 'function' ? 'função' : t.valor === 'class' ? 'classe' : 'variável'}.`,
        local: localDe(nome),
        dica: `Escolha outro nome, por exemplo ${codigo(nome.valor === 'class' ? 'turma' : 'meu' + nome.valor[0].toUpperCase() + nome.valor.slice(1))}.`,
        refs: [],
      };
    }
  }
  return null;
}

/** Dois valores lado a lado sem nada entre eles: "Olá" nome, idade 3, linha que não terminou com vírgula... */
function analisarValoresJuntos(ctx, pos) {
  const { toks } = ctx;
  const k = ctx.indiceEm(pos);
  const b = toks[k];
  const a = toks[k - 1];
  if (!a || !b || !ehExpressaoFim(a) || !ehExpressaoInicio(b)) return null;

  // Descobre em que estrutura estamos: ( [ ou {
  let prof = 0;
  let abre = null;
  for (let j = k - 1; j >= 0; j--) {
    if (ehFecha(toks[j])) prof++;
    else if (ehAbre(toks[j])) { if (prof === 0) { abre = toks[j]; break; } prof--; }
  }

  if (a.linha !== b.linha) {
    const ehChave = toks[k + 1] && toks[k + 1].valor === ':';
    if (abre && (abre.valor === '[' || (abre.valor === '{' && ehChave) || abre.valor === '(')) {
      return {
        causa: `Falta uma vírgula ${codigo(',')} no fim da linha ${a.linha + 1}, depois de ${codigo(a.valor)}.`,
        local: { linha: a.linha, col: a.fimCol, fimCol: a.fimCol + 1 },
        dica: abre.valor === '{' ? 'Em objetos, cada par chave: valor é separado por vírgula.' : 'Os itens são separados por vírgula.',
        correcao: { titulo: 'Inserir vírgula', linha: a.linha, col: a.fimCol, fimLinha: a.linha, fimCol: a.fimCol, texto: ',' },
        refs: [],
      };
    }
    return null;
  }

  const temTexto = a.tipo === 'str' || a.tipo === 'tpl' || b.tipo === 'str' || b.tipo === 'tpl';
  const dentroDeChamada = abre && abre.valor === '(';
  return {
    causa: `${codigo(a.valor)} e ${codigo(b.valor)} estão lado a lado sem nada entre eles: falta ${temTexto ? `${codigo('+')} (para juntar os textos)` : 'um operador (+, -, *, /, ===...)'}${dentroDeChamada || (abre && abre.valor === '[') ? ` ou ${codigo(',')} (para separar ${dentroDeChamada ? 'os argumentos' : 'os itens'})` : ''}.`,
    local: { linha: a.linha, col: a.col, fimCol: b.fimCol },
    dica: temTexto ? `Exemplo: ${codigo(`${a.valor} + ${b.valor}`)}${dentroDeChamada ? ` ou ${codigo(`${a.valor}, ${b.valor}`)}` : ''}, ou use template string: ${codigo('`Olá ${nome}`')}.` : undefined,
    correcao: temTexto ? { titulo: 'Inserir "+" entre os valores', linha: a.linha, col: a.fimCol, fimLinha: a.linha, fimCol: b.col, texto: ' + ' } : undefined,
    refs: [],
  };
}

// ================================================================ análise: nomes e propriedades

function analisarPropriedade(ctx, mensagem, pos) {
  const m = /^Property ['"](.+?)['"] does not exist on type ['"](.+?)['"]\.?(?:\s+Did you mean ['"](.+?)['"]\?)?(?:\s+Did you forget to use 'await'\?)?/i.exec(mensagem);
  if (!m) return null;
  const [, prop, tipo, sugestaoTs] = m;
  const k = ctx.indiceEm(pos);
  const t = ctx.toks[k] && ctx.toks[k].valor === prop ? ctx.toks[k] : null;
  const local = t ? localDe(t) : null;

  if (/Did you forget to use 'await'/i.test(mensagem) || (/^Promise</.test(tipo) && ['json', 'text', 'length', 'map', 'data', 'status', 'ok'].includes(prop))) {
    return {
      causa: `${codigo(prop)} não existe numa Promise. O valor ainda não chegou: falta ${codigo('await')} antes da chamada que devolve a Promise.`,
      local,
      dica: `Use ${codigo('const resposta = await fetch(...)')} (dentro de uma função async) ou ${codigo('.then((resposta) => resposta.' + prop + ')')}.`,
      exemplo: 'const resposta = await fetch("/api");\nconst dados = await resposta.json();',
      refs: ['await', 'Promise'],
    };
  }

  const metodos = metodosDoTipo(tipo);
  const sugestao = sugestaoTs ?? (metodos ? maisParecida(prop, metodos.lista) : null);
  if (sugestao && sugestao !== prop) {
    const caixa = sugestao.toLowerCase() === prop.toLowerCase();
    return {
      causa: caixa
        ? `${codigo(prop)} está com maiúsculas/minúsculas erradas: o certo é ${codigo(sugestao)}.`
        : `${codigo(prop)} está escrito errado: o certo é ${codigo(sugestao)}.`,
      local,
      correcao: local ? { titulo: `Trocar "${prop}" por "${sugestao}"`, linha: local.linha, col: local.col, fimLinha: local.linha, fimCol: local.fimCol, texto: sugestao } : undefined,
      refs: [sugestao],
    };
  }
  // Método de array usado em algo que não é array (ex.: objeto).
  const arrayMetodos = ['map', 'filter', 'forEach', 'reduce', 'find', 'push', 'length', 'includes'];
  if (arrayMetodos.includes(prop) && (!metodos || metodos.nome !== 'Array')) {
    return {
      causa: `${codigo(prop)} é um método de arrays (listas), mas este valor é do tipo ${codigo(tipo)}, que não é um array.`,
      local,
      dica: tipo.startsWith('{') || tipo === 'object'
        ? `Para percorrer um objeto use ${codigo('Object.keys(obj)')}, ${codigo('Object.values(obj)')} ou ${codigo('Object.entries(obj)')} — eles devolvem arrays.`
        : 'Confira se a variável realmente contém uma lista. Talvez você precise de um campo dela (ex.: dados.itens.map(...)).',
      refs: [prop, 'Object.entries'],
    };
  }
  return null;
}

function analisarNome(ctx, mensagem, pos) {
  const m = /^Cannot find name ['"](.+?)['"]\.?(?:\s+Did you mean ['"](.+?)['"]\?)?/i.exec(mensagem)
    || /^['"]?([\w$]+)['"]? is not defined/i.exec(mensagem);
  if (!m) return null;
  const nome = m[1];
  const sugestaoTs = m[2];
  // "cosnt nome = 1" -> mais abaixo "Cannot find name 'nome'": a culpa é da declaração com a palavra errada.
  for (let j = 1; j < ctx.toks.length; j++) {
    const decl = ctx.toks[j - 1];
    if (ctx.toks[j].valor !== nome || decl.tipo !== 'id') continue;
    const kw = maisParecida(decl.valor, ['const', 'let', 'var', 'function', 'class']);
    if (kw && kw !== decl.valor) {
      const r = analisarPalavraChave(ctx, [decl.linha], decl.ini);
      if (r) {
        r.causa = `${codigo(nome)} não foi criada porque, na linha ${decl.linha + 1}, ${r.causa.charAt(0).toLowerCase()}${r.causa.slice(1)}`;
        return r;
      }
    }
  }
  const k = ctx.indiceEm(pos);
  const t = ctx.toks[k] && ctx.toks[k].valor === nome ? ctx.toks[k] : ctx.toks.find((o) => o.valor === nome);
  const local = t ? localDe(t) : null;

  const kw = maisParecida(nome, palavrasChave);
  const glob = maisParecida(nome, globais);
  const sugestao = (kw && (!sugestaoTs || sugestaoTs.toLowerCase() === kw.toLowerCase() || /^[A-Z]/.test(sugestaoTs))) ? kw : (sugestaoTs ?? glob);
  if (!sugestao || sugestao === nome) return null;
  const caixa = sugestao.toLowerCase() === nome.toLowerCase();
  return {
    causa: caixa
      ? `${codigo(nome)} está com maiúsculas/minúsculas erradas: o certo é ${codigo(sugestao)} (JavaScript diferencia maiúsculas de minúsculas).`
      : `${codigo(nome)} não existe — provavelmente está escrito errado: o certo é ${codigo(sugestao)}.`,
    local,
    correcao: local ? { titulo: `Trocar "${nome}" por "${sugestao}"`, linha: local.linha, col: local.col, fimLinha: local.linha, fimCol: local.fimCol, texto: sugestao } : undefined,
    refs: [sugestao],
  };
}

// ================================================================ análise: declarações (const, let)

function acharDeclaracao(ctx, nome) {
  const { toks } = ctx;
  for (let k = 0; k < toks.length - 1; k++) {
    if (['const', 'let', 'var', 'function', 'class'].includes(toks[k].valor) && toks[k + 1].valor === nome) return { palavra: toks[k], nome: toks[k + 1] };
  }
  return null;
}

function analisarDeclaracao(ctx, msg, pos) {
  let m = /^Cannot assign to ['"](.+?)['"] because it is a constant|^Assignment to constant variable|^invalid assignment to const ['"]?(.+?)['"]?$/i.exec(msg);
  if (m) {
    let nome = m[1] ?? m[2];
    if (!nome) {
      // Erro de execução (Node aponta para o "="): o nome é a variável antes do operador.
      let k = ctx.indiceEm(pos);
      const t = ctx.toks[k];
      if (t && t.tipo !== 'id') k--;
      nome = ctx.toks[k]?.tipo === 'id' ? ctx.toks[k].valor : null;
    }
    const dec = nome && acharDeclaracao(ctx, nome);
    if (!dec) return null;
    return {
      causa: `${codigo(nome)} foi criada com ${codigo('const')} na linha ${dec.palavra.linha + 1}, por isso não pode receber outro valor.`,
      local: localDe(dec.palavra),
      dica: `Se o valor precisa mudar, troque ${codigo('const')} por ${codigo('let')} na declaração (linha ${dec.palavra.linha + 1}).`,
      correcao: dec.palavra.valor === 'const' ? { titulo: `Trocar "const" por "let" na linha ${dec.palavra.linha + 1}`, linha: dec.palavra.linha, col: dec.palavra.col, fimLinha: dec.palavra.linha, fimCol: dec.palavra.fimCol, texto: 'let' } : undefined,
      refs: ['const', 'let'],
    };
  }
  m = /^Cannot redeclare block-scoped variable ['"](.+?)['"]|^Identifier ['"](.+?)['"] has already been declared|^Duplicate identifier ['"](.+?)['"]/i.exec(msg);
  if (m) {
    const nome = m[1] ?? m[2] ?? m[3];
    const decls = [];
    const { toks } = ctx;
    for (let k = 0; k < toks.length - 1; k++) if (['const', 'let', 'var', 'function', 'class'].includes(toks[k].valor) && toks[k + 1].valor === nome) decls.push(toks[k + 1]);
    if (decls.length < 2) return null;
    const outra = decls.find((d) => !(d.ini <= pos && pos < d.fim)) ?? decls[0];
    const linhas = decls.map((d) => d.linha + 1).join(' e ');
    return {
      causa: `${codigo(nome)} foi declarada mais de uma vez no mesmo bloco (linhas ${linhas}).`,
      local: localDe(outra),
      dica: `Para mudar o valor, não repita ${codigo('let')}/${codigo('const')}: escreva só ${codigo(`${nome} = novoValor`)}. Se são coisas diferentes, use outro nome.`,
      refs: ['let'],
    };
  }
  m = /^Block-scoped variable ['"](.+?)['"] used before its declaration|^Cannot access ['"](.+?)['"] before initialization|^can't access lexical declaration ['"]?(.+?)['"]? before initialization/i.exec(msg);
  if (m) {
    const nome = m[1] ?? m[2] ?? m[3];
    const dec = acharDeclaracao(ctx, nome);
    if (!dec) return null;
    return {
      causa: `${codigo(nome)} está sendo usada antes da linha onde é criada (linha ${dec.palavra.linha + 1}).`,
      local: localDe(dec.palavra),
      dica: `Mova a declaração ${codigo(`${dec.palavra.valor} ${nome} = ...`)} para antes do primeiro uso.`,
      refs: [dec.palavra.valor],
    };
  }
  return null;
}

// ================================================================ análise: erros de execução (terminal / console)

/** Início da expressão que termina no token `fim` (ex.: "dados.itens" antes de ".map"). */
function inicioDaExpressao(ctx, fim) {
  const { toks } = ctx;
  let k = fim;
  while (k >= 0) {
    const t = toks[k];
    if (t.valor === ')' || t.valor === ']') { k = abrePar(ctx, k); if (k < 0) return fim; k--; continue; }
    if (t.tipo === 'id' || t.tipo === 'str' || t.tipo === 'num' || t.tipo === 'tpl') {
      const ant = toks[k - 1];
      if (ant && (ant.valor === '.' || ant.valor === '?.')) { k -= 2; continue; }
      return k;
    }
    return k + 1;
  }
  return 0;
}

/**
 * De onde vem um nome? Procura no arquivo:
 *  const x = require('mod') / const { x } = require('mod') / import x from 'mod' / import { x } from 'mod'
 *  const x = algo.funcao(...)   (com ou sem await)
 */
function origemDoNome(ctx, nome) {
  if (!nome || !/^[\w$]+$/.test(nome)) return null;
  const linhas = ctx.linhas;
  const n = nome.replace(/\$/g, '\\$');
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    let m = new RegExp(`\\b(?:const|let|var)\\s+(\\{[^}]*\\b${n}\\b[^}]*\\}|${n})\\s*=\\s*require\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`).exec(l);
    if (m) return { tipo: 'require', desestruturado: m[1].startsWith('{'), modulo: m[2], linha: i };
    m = new RegExp(`^\\s*import\\s+(?:(${n})|\\{[^}]*\\b${n}\\b[^}]*\\}|\\*\\s+as\\s+${n})\\s+from\\s+['"]([^'"]+)['"]`).exec(l);
    if (m) return { tipo: 'import', desestruturado: !m[1], modulo: m[2], linha: i };
    m = new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*=\\s*(await\\s+)?([\\w$.]+)\\s*\\(`).exec(l);
    if (m) return { tipo: 'chamada', comAwait: !!m[1], funcao: m[2], linha: i };
  }
  return null;
}

/** A função chamada parece assíncrona? (declarada como async neste arquivo, ou nome típico de busca) */
function pareceAssincrona(ctx, funcao) {
  const ultimo = funcao.split('.').pop();
  const n = ultimo.replace(/\$/g, '\\$');
  if (new RegExp(`async\\s+(?:function\\s*\\*?\\s*)?${n}\\s*\\(|${n}\\s*=\\s*async\\b|static\\s+async\\s+${n}\\s*\\(`).test(ctx.texto)) return 'certeza';
  if (/^(fetch|buscar|carregar|obter|consultar|listar|salvar|criar|atualizar|deletar|remover|get|find|load|query|save|insert|update|delete|request|axios)/i.test(ultimo)) return 'talvez';
  return null;
}

/** Dica para quando um nome importado não é o que se esperava (não é função/classe). */
function dicaDeExportacao(origem, nome, oQueEsperava) {
  if (!origem || (origem.tipo !== 'require' && origem.tipo !== 'import')) return null;
  const mod = origem.modulo;
  if (origem.tipo === 'require') {
    return origem.desestruturado
      ? `${codigo(nome)} vem de ${codigo(`require('${mod}')`)} com chaves: confira se ${codigo(mod)} exporta ${codigo(nome)} dentro do objeto (${codigo(`module.exports = { ${nome} }`)}) e se o nome está igual.`
      : `${codigo(nome)} vem de ${codigo(`require('${mod}')`)}. Confira o final de ${codigo(mod)}: para receber ${oQueEsperava} ele precisa ter ${codigo(`module.exports = ${nome}`)}. Se ele exporta um objeto (${codigo(`module.exports = { ${nome} }`)}), importe com chaves: ${codigo(`const { ${nome} } = require('${mod}')`)}. Se esqueceu o ${codigo('module.exports')}, o require devolve ${codigo('{}')}.`;
  }
  return origem.desestruturado
    ? `${codigo(nome)} vem de ${codigo(`import { ${nome} } from '${mod}'`)}: confira se ${codigo(mod)} tem ${codigo(`export function ${nome}`)} / ${codigo(`export class ${nome}`)} com esse nome.`
    : `${codigo(nome)} vem de ${codigo(`import ${nome} from '${mod}'`)} (export default). Confira se ${codigo(mod)} tem ${codigo(`export default ${nome}`)}; se ele usa ${codigo(`export { ${nome} }`)}, importe com chaves.`;
}

const METODOS_DE_ARRAY = ['map', 'filter', 'forEach', 'reduce', 'find', 'findIndex', 'push', 'pop', 'includes', 'join', 'some', 'every', 'sort', 'slice', 'splice', 'indexOf', 'flat', 'flatMap'];
// Métodos de bibliotecas de banco de dados (Sequelize, Mongoose, Prisma, Knex, mysql2/pg).
const METODOS_DE_BANCO = new Set([
  'findAll', 'findOne', 'findByPk', 'findOrCreate', 'findAndCountAll', 'bulkCreate', 'destroy', 'upsert', 'increment', 'decrement',
  'findById', 'findByIdAndUpdate', 'findByIdAndDelete', 'findOneAndUpdate', 'findOneAndDelete', 'updateOne', 'updateMany',
  'deleteOne', 'deleteMany', 'insertMany', 'countDocuments', 'aggregate', 'populate', 'lean',
  'findMany', 'findUnique', 'findFirst', 'createMany', 'upsertMany',
  'query', 'execute', 'getConnection',
]);

function analisarErroDeExecucao(ctx, msg, pos, linha) {
  const { toks } = ctx;
  const naLinha = (pred) => {
    // token da linha que satisfaz pred, preferindo o mais próximo da coluna informada
    const lista = toks.map((t, k) => [t, k]).filter(([t]) => t.linha === linha && pred(t));
    lista.sort((a, b) => Math.abs(a[0].ini - pos) - Math.abs(b[0].ini - pos));
    return lista[0] ?? null;
  };

  // Cannot read/set properties of undefined (reading 'x')
  let m = /^Cannot (read|set) propert(?:y|ies) (?:['"](.+?)['"] )?of (undefined|null)(?: \((?:reading|setting) ['"](.+?)['"]\))?/i.exec(msg);
  if (m) {
    const [, acao, propA, valor, propB] = m;
    const prop = propA ?? propB;
    const achado = prop
      ? naLinha((t) => t.valor === prop && ['.', '?.'].includes(toks[toks.indexOf(t) - 1]?.valor)) ?? naLinha((t) => t.valor === '[')
      : naLinha((t) => t.valor === '.' || t.valor === '[');
    if (!achado) return null;
    const [tok, k] = achado;
    const fimObj = tok.valor === '[' || tok.valor === '.' ? k - 1 : k - 2;
    if (fimObj < 0) return null;
    const ini = inicioDaExpressao(ctx, fimObj);
    const exprIni = toks[ini], exprFim = toks[fimObj];
    if (!exprIni || exprIni.linha !== linha) return null;
    const expr = ctx.texto.slice(exprIni.ini, exprFim.fim);
    const r = {
      causa: `${codigo(expr)} está ${codigo(valor)} nesta linha, por isso não dá para ${acao === 'read' ? 'ler' : 'definir'} ${prop ? codigo('.' + prop) : 'uma propriedade'} dele.`,
      local: { linha, col: exprIni.col, fimCol: exprFim.fimCol },
      refs: [],
    };
    const raiz = exprIni.valor;
    if (raiz === 'this') {
      // Método passado como callback (router.get('/', controller.listar)) perde o this.
      r.causa = `${codigo('this')} está ${codigo(valor)} aqui: o método foi chamado "solto", sem o objeto dele, por isso ${codigo('this' + (prop && expr === 'this' ? '.' + prop : expr.slice(4)))} não funciona.`;
      r.dica = `Isso acontece quando um método de classe é passado direto como callback, ex.: ${codigo("router.get('/', controller.listar)")}. Use uma arrow function — ${codigo("router.get('/', (req, res) => controller.listar(req, res))")} — ou ${codigo('controller.listar.bind(controller)')}.`;
      return r;
    }
    const origem = origemDoNome(ctx, raiz);
    if (origem && origem.tipo === 'chamada' && !origem.comAwait && expr !== raiz) {
      const async = pareceAssincrona(ctx, origem.funcao);
      if (async) {
        r.causa = `${codigo(expr)} está ${codigo(valor)} porque ${codigo(raiz)} ${async === 'certeza' ? 'é' : 'provavelmente é'} uma Promise: na linha ${origem.linha + 1} ${codigo(origem.funcao + '(...)')} foi chamada sem ${codigo('await')}.`;
        r.local = { linha: origem.linha, col: ctx.linhas[origem.linha].indexOf(origem.funcao), fimCol: ctx.linhas[origem.linha].indexOf(origem.funcao) + origem.funcao.length };
        r.dica = `Funções ${codigo('async')} devolvem uma Promise, não o valor. Use ${codigo(`const ${raiz} = await ${origem.funcao}(...)`)} (e a função de fora precisa ser ${codigo('async')}).`;
        r.correcao = { titulo: `Adicionar "await" antes de ${origem.funcao}(...)`, linha: r.local.linha, col: r.local.col, fimLinha: r.local.linha, fimCol: r.local.col, texto: 'await ' };
        r.refs = ['await', 'async'];
        return r;
      }
    }
    if (/^req\.body$/.test(expr)) {
      r.dica = `Em Express, ${codigo('req.body')} só existe se o servidor ligar o leitor de JSON antes das rotas: ${codigo('app.use(express.json())')}. Para formulários HTML, também ${codigo('app.use(express.urlencoded({ extended: true }))')}.`;
      return r;
    }
    r.dica = valor === 'null' && /getElementById|querySelector/.test(ctx.linhas.join('\n'))
        ? `Se ${codigo(expr)} veio de ${codigo('getElementById')}/${codigo('querySelector')}, o elemento não foi encontrado: confira o id/seletor no HTML e se o ${codigo('<script>')} está no fim do ${codigo('<body>')} (ou use ${codigo('defer')}).`
        : `Confira se ${codigo(expr)} recebeu um valor antes desta linha: o nome da propriedade está certo? O dado já chegou (falta ${codigo('await')})? Para não quebrar quando estiver vazio: ${codigo(expr + '?.' + (prop ?? 'x'))}.`;
    return r;
  }

  // Cannot destructure property 'nome' of 'req.body' as it is undefined
  m = /^Cannot destructure (?:property ['"](.+?)['"] of )?['"](.+?)['"] as it is (undefined|null)/i.exec(msg);
  if (m) {
    const [, prop, obj, valor] = m;
    const texto = ctx.linhas[linha] ?? '';
    const col = texto.indexOf(obj);
    return {
      causa: `${codigo(obj)} está ${codigo(valor)} nesta linha, então não dá para tirar ${prop ? codigo(prop) : 'valores'} dele com ${codigo('{ }')}.`,
      local: col >= 0 ? { linha, col, fimCol: col + obj.length } : null,
      dica: /req\.body/.test(obj)
        ? `Em Express, ${codigo('req.body')} só existe se o servidor ligar o leitor de JSON ANTES das rotas: ${codigo('app.use(express.json())')} no server/app. Para formulários HTML: ${codigo('app.use(express.urlencoded({ extended: true }))')}. E o cliente precisa enviar ${codigo('Content-Type: application/json')}.`
        : `Garanta um valor padrão: ${codigo(`const { ${prop ?? '...'} } = ${obj} ?? {}`)}, ou confira por que ${codigo(obj)} chegou vazio.`,
      refs: [],
    };
  }

  // Express: "argument handler must be a function" / "Route.get() requires a callback function but got a [object Undefined]"
  m = /^argument handler must be a function|requires a callback function but got a \[object (\w+)\]|requires a middleware function/i.exec(msg);
  if (m) {
    // último argumento da chamada router.xxx(...) / app.use(...) nesta linha
    const texto = ctx.linhas[linha] ?? '';
    const chamada = /\b(\w+)\.(get|post|put|patch|delete|use|all)\s*\(([^]*?)\)\s*;?\s*$/.exec(texto);
    if (!chamada) return null;
    const args = chamada[3].split(',').map((a) => a.trim()).filter(Boolean);
    const ultimo = args[args.length - 1];
    const col = texto.lastIndexOf(ultimo);
    const nome = /^[\w$]+/.exec(ultimo)?.[0];
    const origem = origemDoNome(ctx, nome);
    return {
      causa: `${codigo(ultimo)}, passado para ${codigo(`${chamada[1]}.${chamada[2]}()`)}, não é uma função${m[1] ? ` (é ${m[1]})` : ''}. A rota precisa receber uma função ${codigo('(req, res) => { ... }')}.`,
      local: col >= 0 ? { linha, col, fimCol: col + ultimo.length } : null,
      dica: dicaDeExportacao(origem, nome, 'uma função')
        ?? `Se ${codigo(ultimo)} é um método de um controller, confira o nome e se o controller foi exportado/importado certo.`,
      refs: [],
    };
  }

  // Cannot set headers after they are sent to the client
  if (/Cannot set headers after they are sent/i.test(msg)) {
    const k = ctx.indiceEm(pos);
    const fn = funcaoQueEnvolve(ctx, k);
    const ini = fn && fn.inicio ? fn.inicio.ini : 0;
    const anteriores = [];
    for (let j = k - 1; j >= 0 && toks[j].ini >= ini; j--) {
      const t = toks[j];
      if (t.tipo === 'id' && t.valor === 'res' && toks[j + 1]?.valor === '.' && t.linha < linha) anteriores.push(j);
    }
    const envio = anteriores.find((j) => /^res\.(?:status\([^)]*\)\.)?(json|send|end|redirect|render|sendStatus|sendFile|download)\b/.test(ctx.texto.slice(toks[j].ini, toks[j].ini + 80)));
    if (envio === undefined) {
      return {
        causa: 'Esta linha tenta enviar a resposta, mas ela já tinha sido enviada antes (cada requisição só pode ter uma resposta).',
        local: null,
        dica: `Procure outro ${codigo('res.json')}/${codigo('res.send')} que roda antes deste e coloque ${codigo('return')} nele: ${codigo('return res.status(404).json(...)')}.`,
        refs: [],
      };
    }
    const t = toks[envio];
    const temReturn = toks[envio - 1]?.valor === 'return';
    return {
      causa: `A resposta já foi enviada na linha ${t.linha + 1} e o código continuou até a linha ${linha + 1}, que tenta responder de novo. Cada requisição só pode ter UMA resposta.`,
      local: localDe(t),
      dica: temReturn
        ? 'Confira o fluxo: algum caminho envia a resposta duas vezes (ex.: dentro de um laço ou de um callback).'
        : `Coloque ${codigo('return')} na resposta da linha ${t.linha + 1}, para a função parar ali: ${codigo('return ' + (ctx.linhas[t.linha] ?? '').trim())}`,
      correcao: temReturn ? undefined : { titulo: `Adicionar "return" na resposta da linha ${t.linha + 1}`, linha: t.linha, col: t.col, fimLinha: t.linha, fimCol: t.col, texto: 'return ' },
      refs: ['return'],
    };
  }

  // X is not a constructor
  m = /^(.+?) is not a constructor/i.exec(msg);
  if (m) {
    const nome = m[1].split('.').pop();
    const achado = naLinha((t) => t.valor === nome);
    const origem = origemDoNome(ctx, m[1].split('.')[0]);
    return {
      causa: `${codigo(m[1])} não é uma classe, por isso não dá para usar ${codigo('new ' + m[1] + '(...)')}.`,
      local: achado ? localDe(achado[0]) : null,
      dica: dicaDeExportacao(origem, m[1].split('.')[0], 'a classe')
        ?? `Confira o nome e se ${codigo(m[1])} é mesmo uma classe (${codigo('class ' + nome + ' { ... }')}). Arrow functions e objetos não funcionam com ${codigo('new')}.`,
      refs: ['class', 'new'],
    };
  }

  // x.map is not a function / x is not a function
  m = /^(.+?) is not a function(?: or its return value is not iterable)?$/i.exec(msg);
  if (m) {
    const nomeCompleto = m[1].replace(/^\(intermediate value\)\.?/, '');
    const partes = nomeCompleto.split('.');
    const prop = partes.pop();
    const obj = partes.join('.');
    const achado = naLinha((t) => t.valor === prop);
    const local = achado ? localDe(achado[0]) : null;
    if (obj && METODOS_DE_ARRAY.includes(prop)) {
      return {
        causa: `${codigo(obj)} não é um array (lista), por isso não tem o método ${codigo(prop)}. Ele guarda outro tipo de valor (objeto, texto, número...).`,
        local,
        dica: `Veja o que ${codigo(obj)} contém com ${codigo(`console.log(${obj})`)}. Se for um objeto, use ${codigo(`Object.values(${obj}).${prop}(...)`)} ou ${codigo(`Object.entries(${obj})`)}; se a lista estiver dentro dele, acesse o campo certo (ex.: ${codigo(`${obj}.itens.${prop}(...)`)}).`,
        refs: [prop, 'Object.entries'],
      };
    }
    // Veio de require/import? Então o problema quase sempre é o que o outro arquivo exporta.
    const raizNome = (obj || prop).split('.')[0];
    const origem = origemDoNome(ctx, raizNome);
    const dicaExport = dicaDeExportacao(origem, raizNome, obj ? `um objeto com ${codigo(prop)}` : 'uma função');
    if (dicaExport) {
      return {
        causa: obj
          ? `${codigo(obj)} não tem uma função ${codigo(prop)}: o que veio de ${codigo(origem.modulo)} não é o que este código espera.`
          : `${codigo(prop)} não é uma função: o que veio de ${codigo(origem.modulo)} não é uma função.`,
        local,
        dica: obj
          ? `Confira em ${codigo(origem.modulo)} se existe ${codigo(prop)} e se ele está no ${codigo('module.exports')}/${codigo('export')} (ex.: ${codigo(`module.exports = { ${prop} }`)}). Sem ${codigo('module.exports')}, o require devolve ${codigo('{}')}.`
          : dicaExport,
        refs: [],
      };
    }
    // Métodos de bibliotecas de banco (Sequelize, Mongoose, Prisma, Knex...): não é erro de digitação
    // (ex.: "findAll" não deve virar "finally"); o objeto é que não é um model/cliente dessa biblioteca.
    if (obj && METODOS_DE_BANCO.has(prop)) {
      return {
        causa: `${codigo(obj)} não tem o método ${codigo(prop)}: ${codigo(prop)} é um método de bibliotecas de banco de dados (Sequelize, Mongoose, Prisma...), e ${codigo(obj)} não é um model/cliente criado por uma delas.`,
        local,
        dica: `Confira se ${codigo(obj)} foi criado com a biblioteca (ex.: ${codigo("sequelize.define('Usuario', {...})")}, ${codigo("mongoose.model('Usuario', schema)")}), se o arquivo do model faz ${codigo(`module.exports = ${obj.split('.').pop()}`)} e se o import/require está pegando esse export (com ou sem chaves). Confira também se o nome do método é dessa biblioteca (ex.: ${codigo('findAll')} é do Sequelize; no Mongoose é ${codigo('find')}).`,
        refs: [],
      };
    }
    const todos = [...new Set(Object.values(require('./referencia-js').metodosPorTipo).flat())];
    const sugestao = prop && maisParecida(prop, todos);
    if (sugestao) {
      return {
        causa: `${codigo(prop)} não existe — provavelmente está escrito errado: o certo é ${codigo(sugestao)}.`,
        local,
        correcao: local ? { titulo: `Trocar "${prop}" por "${sugestao}"`, linha: local.linha, col: local.col, fimLinha: local.linha, fimCol: local.fimCol, texto: sugestao } : undefined,
        refs: [sugestao],
      };
    }
    return {
      causa: `${codigo(nomeCompleto)} não é uma função, mas está sendo chamado com ${codigo('()')}.`,
      local,
      dica: `Confira o nome (maiúsculas/minúsculas contam) e o que ${codigo(nomeCompleto)} guarda: se é um valor (texto, número, objeto), não use ${codigo('()')} depois dele.`,
      refs: [],
    };
  }

  // JSON.parse com texto inválido (mensagens novas e antigas do V8)
  m = /in JSON at position (\d+)|^Unexpected end of JSON input|is not valid JSON|^JSON\.parse: /i.exec(msg);
  if (m) {
    const posicao = m[1] !== undefined ? Number(m[1]) : null;
    const achado = naLinha((t) => t.valor === 'parse' && toks[toks.indexOf(t) - 2]?.valor === 'JSON');
    if (!achado) return null;
    const [, k] = achado;
    const arg = toks[k + 2];
    if (!toks[k + 1] || toks[k + 1].valor !== '(' || !arg) return null;
    const motivo =
      /Expected property name/i.test(msg) ? `os nomes das propriedades precisam estar entre aspas duplas (${codigo('{"nome": "Ana"}')}, não ${codigo('{nome: "Ana"}')})`
      : /double-quoted property name/i.test(msg) ? `provavelmente há uma vírgula sobrando antes do ${codigo('}')} (JSON não aceita vírgula no final)`
      : /after property value|after array element/i.test(msg) ? 'falta uma vírgula entre os itens, ou o fechamento do objeto/lista'
      : /Unterminated string/i.test(msg) ? 'um texto entre aspas não foi fechado'
      : /end of JSON input/i.test(msg) ? 'o texto está vazio ou incompleto'
      : /Unexpected token '?</i.test(msg) ? `o texto começa com ${codigo('<')}: provavelmente é uma página HTML (ex.: erro 404 do servidor), não JSON`
      : `JSON usa aspas duplas (não simples) e não aceita vírgula sobrando nem comentários`;

    if ((arg.tipo === 'str' || (arg.tipo === 'tpl' && !arg.valor.includes('${'))) && ctx.offset(arg.linha, 0) + ctx.linhas[arg.linha].length >= arg.fim) {
      // Texto escrito direto no código: aponta o caractere exato da "position N".
      const bruto = arg.valor.slice(1, -1);
      let col = null;
      if (posicao !== null) {
        let lidos = 0;
        for (let j = 0; j <= bruto.length; j++) {
          if (lidos === posicao) { col = arg.col + 1 + j; break; }
          if (bruto[j] === '\\') j++;
          lidos++;
        }
      }
      return {
        causa: `O texto passado para ${codigo('JSON.parse')} não é um JSON válido: ${motivo}.`,
        local: col !== null ? { linha: arg.linha, col, fimCol: col + 1 } : localDe(arg),
        dica: col !== null ? `O problema está no caractere ${codigo(ctx.linhas[arg.linha][col] ?? '')} (posição ${posicao} do texto).` : undefined,
        exemplo: 'const pessoa = JSON.parse(\'{"nome": "Ana", "idade": 30}\');',
        refs: ['JSON.parse'],
      };
    }
    return {
      causa: `O texto passado para ${codigo('JSON.parse')} não é um JSON válido: ${motivo}.`,
      local: localDe(arg),
      dica: `Veja o que chegou com ${codigo(`console.log(${ctx.texto.slice(arg.ini, arg.fim)})`)}. Se o texto veio de um ${codigo('fetch')}, use ${codigo('await resposta.json()')} e confira se a URL devolve JSON mesmo (e não uma página HTML de erro).`,
      refs: ['JSON.parse', 'json'],
    };
  }

  // Erro lançado pelo próprio código: throw new Error('...') sem ninguém tratar
  const lancamento = naLinha((t) => t.valor === 'throw');
  if (lancamento && !/^(?:Cannot|.+ is not |Unexpected|Invalid|Maximum|Assignment)/i.test(msg)) {
    const k = lancamento[1];
    const fn = funcaoQueEnvolve(ctx, k);
    const nomeFn = fn && fn.inicio ? (ctx.linhas[fn.inicio.linha] ?? '').slice(fn.inicio.col).match(/^(?:async\s+)?(?:function\s+)?(?:static\s+)?(?:async\s+)?([\w$]+)/)?.[1] : null;
    return {
      causa: `Este erro foi lançado pelo próprio código, com ${codigo('throw')} na linha ${linha + 1}${nomeFn && nomeFn !== 'function' ? ` (dentro de ${codigo(nomeFn)})` : ''}, e ninguém o tratou, então o programa parou.`,
      local: localDe(lancamento[0]),
      dica: `Se o erro é esperado (ex.: banco fora do ar), trate onde a função é chamada: ${codigo('try { await ' + (nomeFn ?? 'funcao') + '() } catch (erro) { ... }')} ou ${codigo('.catch((erro) => ...)')}. A mensagem do erro é a que você escreveu no ${codigo('throw')}.`,
      refs: ['throw', 'try'],
    };
  }

  // x is not iterable
  m = /^(.+?) is not iterable/i.exec(msg);
  if (m) {
    const achado = naLinha((t) => t.valor === 'of') ?? naLinha((t) => t.valor === '...');
    let local = null;
    let expr = m[1];
    if (achado) {
      const [, k] = achado;
      let fim = k + 1;
      while (toks[fim + 1] && toks[fim + 1].linha === linha && !['{', ')', ';', ','].includes(toks[fim + 1].valor)) fim++;
      if (toks[fim]) { expr = ctx.texto.slice(toks[k + 1].ini, toks[fim].fim); local = { linha, col: toks[k + 1].col, fimCol: toks[fim].fimCol }; }
    }
    return {
      causa: `${codigo(expr)} não é uma lista (iterável), então não dá para percorrer com ${codigo('for...of')} nem espalhar com ${codigo('...')}.`,
      local,
      dica: `Se for um objeto, use ${codigo(`Object.entries(${expr})`)} ou ${codigo(`Object.values(${expr})`)}. Se puder estar vazio, garanta um array: ${codigo(`${expr} ?? []`)}.`,
      refs: ['for', 'Object.entries'],
    };
  }
  return null;
}

// ================================================================ análise: pequenos erros de pontuação

function analisarPontuacao(ctx, pos, msg) {
  const { toks } = ctx;
  const k = ctx.indiceEm(pos);
  const t = toks[k];
  const a = toks[k - 1];
  if (!t || !a) return null;
  // ",," vírgula a mais
  if (t.valor === ',' && a.valor === ',' || (t.valor === ')' && a.valor === ',' && /Parameter declaration expected/i.test(msg))) {
    const v = t.valor === ',' ? t : a;
    return {
      causa: `Há uma vírgula ${codigo(',')} a mais aqui (vírgula sem nada entre elas).`,
      local: localDe(v),
      correcao: { titulo: 'Remover vírgula a mais', linha: v.linha, col: v.col, fimLinha: v.linha, fimCol: v.fimCol, texto: '' },
      refs: [],
    };
  }
  // "a == )", "x = ;", "total + }": operador sem o valor da direita
  const OPS = ['=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '&&', '||', '??', '+=', '-=', '*=', '/=', '**'];
  if (a.tipo === 'pont' && OPS.includes(a.valor) && [')', ';', '}', ']', ','].includes(t.valor)) {
    return {
      causa: `Falta o valor depois do ${codigo(a.valor)}: o operador ficou sem nada do lado direito.`,
      local: localDe(a),
      dica: `Exemplo: ${codigo(a.valor.includes('=') && a.valor.length > 1 ? `x ${a.valor} 10` : `x ${a.valor} y`)}.`,
      refs: [],
    };
  }
  // "function () {}" como declaração
  if (/Identifier expected|function statement requires a name/i.test(msg) && a.valor === 'function' && t.valor === '(') {
    return {
      causa: `A função não tem nome. Uma declaração ${codigo('function')} precisa de um nome logo depois da palavra function.`,
      local: localDe(a),
      dica: `Escreva ${codigo('function nomeDaFuncao() { ... }')}, ou guarde numa variável: ${codigo('const minhaFuncao = function () { ... };')}.`,
      refs: ['function'],
    };
  }
  return null;
}

/** Erros de sintaxe "fortes" numa linha: quando existe um, os outros erros dessa linha são consequência dele. */
function causaNaLinha(ctx, linha, pos) {
  return analisarCaractere(ctx, linha) || analisarStringAberta(ctx, linha)
    || analisarPalavraChave(ctx, [linha], pos)
    || analisarReservadaComoNome(ctx, linha) || analisarSetaSeparada(ctx, linha) || analisarCondicaoSemParenteses(ctx, linha);
}

// ================================================================ análise principal

const MSG_SINTAXE = /^(?:Parsing error: )?(?:'[;,)\]}(]' expected|'.' expected|Expression expected|Declaration or statement expected|Identifier expected|Unexpected token|Unexpected keyword or identifier|Unknown keyword or identifier|Argument expression expected|Property assignment expected|Unexpected end of input|Invalid character|Unterminated (?:string|template)|Variable declaration not allowed|Missing semicolon|Unexpected identifier|Unexpected string|Unexpected number|missing \) after|Invalid or unexpected token|Statements must be separated)/i;

/**
 * Analisa um diagnóstico.
 * @param {string} texto  conteúdo do arquivo
 * @param {{linha:number, coluna:number, mensagem:string, codigo?:string|number}} diag
 */
function analisar(texto, diag) {
  const ctx = criarContexto(texto);
  // Mensagens do terminal/console vêm com prefixo: "Uncaught TypeError: ...", "SyntaxError: ..."
  const msg = String(diag.mensagem).split(/\r?\n/)[0].trim()
    .replace(/^Uncaught (?:\(in promise\) )?/i, '')
    .replace(/^(?:[A-Z][A-Za-z]*Error|Error): /, '');
  const pos = ctx.offset(diag.linha, diag.coluna);
  const linha = diag.linha;
  let r = analisarInterno(ctx, msg, pos, linha, String(diag.codigo ?? ''));
  if (!r && !/^(?:'.+?' is declared but|All (?:imports|variables) are unused|.+ is (?:assigned a value|defined) but never used)/i.test(msg)) {
    // Sem causa própria: se a linha tem um erro de sintaxe "forte", este erro é consequência dele.
    const c = causaNaLinha(ctx, linha, pos);
    if (c) r = { ...c, consequencia: true };
  }
  if (!r) return null;
  r.refs = (r.refs ?? []).filter(Boolean);
  return r;
}

function analisarInterno(ctx, msg, pos, linha, cod) {
  // await sem async
  if (/'await' expressions are only allowed within async functions|await is only valid in async function|Cannot use keyword 'await' outside an async function|'await' is only allowed within async functions/i.test(msg) || cod === '1308') {
    return analisarAwait(ctx, pos, false);
  }
  if (/'await' expressions are only allowed at the top level of a file when that file is a module/i.test(msg) || cod === '1375') {
    return analisarAwait(ctx, pos, true);
  }

  // Palavra-chave/nome escrito errado
  if (/^Unknown keyword or identifier/i.test(msg)) {
    const r = analisarPalavraChave(ctx, [linha], pos);
    if (r) return r;
  }
  if (/^Cannot find name|is not defined/i.test(msg)) {
    const r = analisarPalavraChave(ctx, [linha], pos);
    if (r) return r; // o nome não existe porque a palavra-chave da linha está errada (ou é ela mesma)
    return analisarNome(ctx, msg, pos);
  }
  if (/^Property .+ does not exist on type/i.test(msg)) return analisarPropriedade(ctx, msg, pos);
  const dec = analisarDeclaracao(ctx, msg, pos);
  if (dec) return dec;
  const exec = analisarErroDeExecucao(ctx, msg, pos, linha);
  if (exec) return exec;

  if (!MSG_SINTAXE.test(msg) && !/Parameter declaration expected|function statement requires a name/i.test(msg)) return null;

  // Erros de sintaxe: procura a causa real, da mais confiável para a menos.
  const linhasPerto = [linha];
  const tokNoErro = ctx.toks[ctx.indiceEm(pos)];
  if (linha > 0 && (!tokNoErro || tokNoErro.linha !== linha || ctx.primeiroDaLinha(tokNoErro))) linhasPerto.push(linha - 1);

  for (const l of linhasPerto) {
    const r = analisarCaractere(ctx, l) || analisarStringAberta(ctx, l);
    if (r) return r;
  }

  const kw = analisarPalavraChave(ctx, linhasPerto, pos);
  if (kw) return kw;

  for (const l of linhasPerto) {
    const r = analisarReservadaComoNome(ctx, l) || analisarSetaSeparada(ctx, l) || analisarCondicaoSemParenteses(ctx, l);
    if (r) return r;
  }

  // Delimitadores: ; dentro de ( ou [, fechamento sobrando, bloco não fechado.
  const problemas = analisarDelimitadores(ctx);
  const fimArquivo = !tokNoErro || pos >= ctx.toks[ctx.toks.length - 1].ini;
  for (const p of problemas) {
    if (p.tipo === 'naoFechado' && p.antes && p.antes.valor === ';' && Math.abs(p.antes.linha - linha) <= 1) return descreverNaoFechado(ctx, p);
  }
  for (const p of problemas) {
    if (p.tipo === 'sobrando' && p.fecha.linha === linha) return descreverSobrando(ctx, p);
  }
  for (const p of problemas) {
    if (p.tipo === 'naoFechado' && p.antes && p.antes.linha === linha && ctx.primeiroDaLinha(p.antes)) return descreverNaoFechado(ctx, p);
  }
  if (fimArquivo || /'[)}\]]' expected|Unexpected end of input|missing \) after/i.test(msg)) {
    const esperado = /'([)}\]])' expected/.exec(msg)?.[1];
    const candidatos = problemas.filter((p) => p.tipo === 'naoFechado' && (!esperado || ABRE[p.abre.valor] === esperado));
    // Prefere o mais próximo antes do erro.
    const antes = candidatos.filter((p) => p.abre.ini <= pos).sort((x, y) => y.abre.ini - x.abre.ini);
    const p = candidatos.find((c) => c.porIndentacao) ?? antes[0];
    if (p && (fimArquivo || p.porIndentacao || p.abre.linha === linha || esperado)) return descreverNaoFechado(ctx, p);
  }

  const pontual = analisarPontuacao(ctx, pos, msg) || analisarValoresJuntos(ctx, pos);
  if (pontual) return pontual;

  // Por último: um bloco { aberto ANTES do erro e nunca fechado explica "Unexpected token" mais abaixo
  // (ex.: falta o } de um método e o Node reclama do "module.exports" no fim do arquivo).
  if (/Unexpected (?:token|identifier|keyword|string|number)|Declaration or statement expected|Expression expected|';' expected/i.test(msg)) {
    const p = problemas.find((x) => x.tipo === 'naoFechado' && x.abre.valor === '{' && x.abre.ini < pos && (x.porIndentacao || x.antes === null));
    if (p) return descreverNaoFechado(ctx, p);
  }
  return null;
}

module.exports = { analisar, tokenizar, distancia, maisParecida, buscarReferencia };
