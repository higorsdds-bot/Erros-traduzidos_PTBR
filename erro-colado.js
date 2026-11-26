// Interpreta um erro copiado do terminal, do console do navegador ou do Python.
// Não depende do VS Code: recebe o texto e devolve a mensagem principal e o local (arquivo, linha, coluna).

// Uma linha com mensagem de erro: "TypeError: x is not a function", "Uncaught (in promise) Error: ...",
// "NameError: name 'x' is not defined", "Error [ERR_MODULE_NOT_FOUND]: ..."
const REGEX_LINHA_ERRO = /(?:Uncaught (?:\(in promise\) )?)?\b(?:[A-Z][A-Za-z]*(?:Error|Exception|Rejection)|Error)(?: \[[A-Z_0-9]+\])?: \S.*/;
const REGEX_CORS = /\S.*has been blocked by CORS policy.*/;
const REGEX_TIPO = /\b([A-Z][A-Za-z]*(?:Error|Exception|Rejection)|Error)(?: \[[A-Z_0-9]+\])?:/;
// Link que o console do navegador mostra à direita da mensagem: "...  app.js:16"
const REGEX_LINK_DIREITA = /\s{2,}((?:https?:\/\/\S+\/)?[\w.-]+\.(?:[cm]?[jt]sx?|html)):(\d+)(?::(\d+))?\s*$/;
const ehCodigoDeBiblioteca = (caminho) => /[\\/]node_modules[\\/]|^node:|^internal[\\/]/.test(caminho);

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-_]/g;

// O que cada tipo de erro significa (JavaScript, segundo a MDN, e Python).
const TIPOS_DE_ERRO = {
  SyntaxError: 'Erro de sintaxe: o código está escrito de um jeito que a linguagem não entende. O programa nem começa a rodar.',
  ReferenceError: 'Erro de referência: o código usou um nome (variável ou função) que não existe naquele ponto.',
  TypeError: 'Erro de tipo: uma operação foi feita num valor do tipo errado (ex.: chamar algo que não é função, ler propriedade de undefined).',
  RangeError: 'Erro de intervalo: um valor ficou fora do limite permitido (ex.: recursão infinita, tamanho de array inválido).',
  URIError: 'Erro de URI: um endereço/URL mal formado foi passado para encodeURI/decodeURI.',
  EvalError: 'Erro relacionado ao eval().',
  InternalError: 'Erro interno do motor JavaScript (geralmente recursão demais).',
  AggregateError: 'Vários erros juntos (ex.: todas as Promises do Promise.any falharam).',
  Error: 'Erro genérico: lançado pelo próprio código (throw new Error(...)), por uma biblioteca ou pelo Node.',
  DOMException: 'Erro de uma API do navegador (DOM, fetch, armazenamento...).',
  UnhandledPromiseRejection: 'Promise rejeitada sem tratamento: uma Promise falhou e nenhum try/catch (com await) ou .catch() cuidou do erro, então o Node encerrou o programa.',
  // Python
  NameError: 'Erro de nome: o código usou uma variável ou função que não existe (não foi criada ou está escrita errado).',
  IndentationError: 'Erro de indentação: os espaços no começo da linha estão errados. Em Python o recuo define os blocos.',
  TabError: 'Mistura de TAB e espaços na indentação. Use só espaços (4 por nível).',
  ZeroDivisionError: 'Divisão por zero.',
  IndexError: 'Posição inválida: o índice não existe na lista/texto (lembre que começa em 0).',
  KeyError: 'Chave inexistente: o dicionário não tem essa chave.',
  ValueError: 'Valor inválido: o tipo está certo, mas o conteúdo não (ex.: int("abc")).',
  AttributeError: 'Atributo inexistente: o objeto não tem esse método/propriedade.',
  ImportError: 'Erro de importação: não foi possível importar o nome pedido.',
  ModuleNotFoundError: 'Módulo não encontrado: o pacote não está instalado ou o nome está errado (instale com pip install ...).',
  FileNotFoundError: 'Arquivo não encontrado: o caminho está errado ou o arquivo não existe.',
  EOFError: 'O input() não recebeu nenhum texto (fim da entrada).',
  RecursionError: 'Recursão demais: uma função chama a si mesma sem parar.',
  UnboundLocalError: 'A variável local foi usada antes de receber valor dentro da função.',
};

/** Tira cores/códigos de controle do terminal e normaliza quebras de linha. */
const limparTexto = (texto) => String(texto ?? '').replace(ANSI, '').replace(/\r\n?/g, '\n');

/** O texto parece uma mensagem de erro? */
function pareceErro(texto) {
  const t = limparTexto(texto);
  return REGEX_LINHA_ERRO.test(t) || REGEX_CORS.test(t)
    || /\b(?:error|exception|traceback|expected|unexpected|is not defined|is not a function|cannot|can't|failed|invalid|unterminated|missing)\b/i.test(t);
}

/**
 * Lê o erro colado.
 * @returns {{ principal: string, mensagens: string[], tipo: string|null,
 *            local: null | { caminho: string, linha: number, coluna: number|null, codigo: string|null, marcador: string|null } }}
 * (linha e coluna começam em 1, como aparecem no terminal)
 */
function interpretarErro(texto) {
  const linhas = limparTexto(texto).split('\n');

  const mensagens = [];
  const semLinkDireita = (l) => l.replace(REGEX_LINK_DIREITA, '').trim();
  for (const l of linhas) {
    if (/^\s+at\s/.test(l)) continue;
    const cors = REGEX_CORS.exec(l);
    if (cors) { mensagens.unshift(semLinkDireita(cors[0])); continue; } // CORS explica melhor que o "Failed to fetch" que vem depois
    const m = REGEX_LINHA_ERRO.exec(l);
    if (m && !mensagens.includes(semLinkDireita(m[0]))) mensagens.push(semLinkDireita(m[0]));
  }
  const principal = mensagens[0]
    ?? linhas.map((l) => l.trim()).find((l) => l && !/^at\s/.test(l) && !/^Node\.js v/.test(l)
      && !/^node:\S+:\d+$/.test(l) && !/^\S+\.[cm]?[jt]sx?:\d+$/.test(l) && !/^[\^~]+$/.test(l))
    ?? '';
  const tipo = REGEX_TIPO.exec(principal)?.[1] ?? null;

  let local = null;

  // 1) Node (erros de sintaxe e erros não tratados): "C:\pasta\arquivo.js:2" + linha do código + "   ^^^^"
  //    Ignora quando o arquivo é de biblioteca (node_modules): aí o útil é o primeiro "at" do usuário.
  for (let i = 0; i < linhas.length && !local; i++) {
    const m = /^((?:file:\/\/\/?|[A-Za-z]:[\\/]|[\\/]|\.{1,2}[\\/])(?:(?!\s{2}).)*?\.(?:[cm]?[jt]sx?|json)):(\d+)$/.exec(linhas[i].trim());
    if (!m || ehCodigoDeBiblioteca(m[1])) continue;
    const marcador = linhas[i + 2] !== undefined && /^\s*\^+\s*$/.test(linhas[i + 2]) ? linhas[i + 2] : null;
    local = { caminho: m[1], linha: Number(m[2]), coluna: marcador ? marcador.indexOf('^') + 1 : null, codigo: linhas[i + 1] ?? null, marcador };
  }

  // 2) Python: o último 'File "...", line N' que é do usuário (o mais interno)
  if (!local) {
    for (let i = linhas.length - 1; i >= 0; i--) {
      const m = /^\s*File "(.+?)", line (\d+)/.exec(linhas[i]);
      if (!m || /site-packages|<frozen |<string>|<stdin>|[\\/]lib[\\/]python|[\\/]node_modules[\\/]/i.test(m[1])) continue;
      const codigo = linhas[i + 1] !== undefined && !/^\s*File "/.test(linhas[i + 1]) && !REGEX_LINHA_ERRO.test(linhas[i + 1]) ? linhas[i + 1] : null;
      const marcador = codigo && linhas[i + 2] !== undefined && /^\s*[\^~]+\s*$/.test(linhas[i + 2]) ? linhas[i + 2] : null;
      local = { caminho: m[1], linha: Number(m[2]), coluna: null, codigo, marcador };
      break;
    }
  }

  // Pilha do JavaScript: frames que são código do usuário (não node:internal nem node_modules)
  const chamadas = [];
  for (const l of linhas) {
    const m = /^\s*at (?:.*?\((.+?):(\d+):(\d+)\)|((?:file:\/\/\/?|https?:\/\/)?[^()\s]+?):(\d+):(\d+))\s*$/.exec(l);
    if (!m) continue;
    const caminho = m[1] ?? m[4];
    if (ehCodigoDeBiblioteca(caminho) || /^<anonymous>$|^native$|^<anonymous>|^evalmachine/.test(caminho)) continue;
    const funcao = /^\s*at (?:async )?(.+?) \(/.exec(l)?.[1] ?? null;
    chamadas.push({ caminho, linha: Number(m[2] ?? m[5]), coluna: Number(m[3] ?? m[6]), funcao });
  }

  // 3) ESM: "Cannot find module 'X' imported from C:\...\arquivo.js" — o arquivo útil é quem importou.
  if (!local) {
    const m = /imported from ((?:file:\/\/\/?|[A-Za-z]:[\\/]|[\\/]).+?\.(?:[cm]?[jt]sx?))\s*$/m.exec(linhas.join('\n'));
    if (m) local = { caminho: m[1], linha: null, coluna: null, codigo: null, marcador: null };
  }

  // 4) Primeiro frame da pilha que é do usuário
  if (!local && chamadas.length) local = { ...chamadas[0], codigo: null, marcador: null };

  // 5) Console do navegador copiado com o link à direita: "Uncaught ReferenceError: x is not defined    app.js:12"
  if (!local) {
    for (const l of linhas) {
      const m = REGEX_LINK_DIREITA.exec(l);
      if (m) { local = { caminho: m[1], linha: Number(m[2]), coluna: m[3] ? Number(m[3]) : null, codigo: null, marcador: null }; break; }
    }
  }

  // Módulo que não foi encontrado / nome que não foi exportado (para achar a linha do import/require).
  const modulo = /Cannot find (?:module|package) '([^']+)'/.exec(principal)?.[1]
    ?? /The requested module '([^']+)'/.exec(principal)?.[1] ?? null;

  return { principal, mensagens, tipo, local, chamadas, modulo };
}

/**
 * Converte a posição do "^^^" (que é relativa à linha impressa) numa coluna do arquivo.
 * O Python imprime a linha sem a indentação original; o Node imprime a linha como está.
 */
function colunaNoArquivo(local, textoDaLinhaNoArquivo) {
  if (!local) return null;
  if (!local.marcador || local.codigo === null) return local.coluna;
  const inicioImpresso = local.codigo.search(/\S/);
  const marca = local.marcador.indexOf(local.marcador.includes('^') ? '^' : '~');
  if (inicioImpresso < 0 || marca < 0) return local.coluna;
  const base = textoDaLinhaNoArquivo ? textoDaLinhaNoArquivo.indexOf(local.codigo.trim()) : -1;
  return (base >= 0 ? base + (marca - inicioImpresso) : marca) + 1;
}

module.exports = { REGEX_LINHA_ERRO, REGEX_CORS, TIPOS_DE_ERRO, limparTexto, pareceErro, interpretarErro, colunaNoArquivo };
