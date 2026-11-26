// Causa de erros de módulo (require/import) olhando o sistema de arquivos:
// arquivo que não existe (e o nome parecido que existe), ".js" esquecido no import,
// pacote não instalado, e nome que o outro arquivo não exporta.
// Não depende do VS Code (usa fs/path do Node).

const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { maisParecida } = require('./analisador');

const codigo = (s) => '`' + s + '`';
const EXTENSOES = ['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.json'];

const paraCaminho = (p) => {
  try { return /^file:/i.test(p) ? fileURLToPath(p) : p; } catch { return p; }
};
const ehRelativo = (esp) => /^\.{1,2}[\\/]|^\.{1,2}$|^[\\/]/.test(esp);
const semExtensao = (n) => n.replace(/\.[cm]?[jt]sx?$|\.json$/i, '');

/** Linhas de import/require do arquivo: [{ linha, col, fimCol, especificador, ehImport, nomes }] */
function importsDoArquivo(texto) {
  const resultado = [];
  texto.split(/\r?\n/).forEach((l, linha) => {
    const re = /(\bimport\s+(?:([\s\S]*?)\s+from\s+)?|\bexport\s+[^'"]*?\s+from\s+|\brequire\s*\(\s*|\bimport\s*\(\s*)(['"`])([^'"`]+)\3/g;
    let m;
    while ((m = re.exec(l))) {
      const col = m.index + m[0].lastIndexOf(m[3] + m[4]) + 1;
      resultado.push({ linha, col, fimCol: col + m[4].length, especificador: m[4], ehImport: !/require/.test(m[1]), nomes: m[2] ?? null });
    }
  });
  return resultado;
}

/** Resolve um especificador relativo como o Node faria (com ou sem extensão / index.js). */
function resolver(dirBase, esp) {
  const alvo = path.resolve(dirBase, esp);
  if (fs.existsSync(alvo) && fs.statSync(alvo).isFile()) return alvo;
  for (const ext of EXTENSOES) if (fs.existsSync(alvo + ext)) return alvo + ext;
  for (const ext of EXTENSOES) if (fs.existsSync(path.join(alvo, 'index' + ext))) return path.join(alvo, 'index' + ext);
  return null;
}

/** Nomes exportados por um arquivo (ESM e CommonJS, aproximado). */
function exportsDoArquivo(texto) {
  const nomes = new Set();
  let temDefault = /\bexport\s+default\b/.test(texto);
  for (const m of texto.matchAll(/\bexport\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var)\s+([\w$]+)/g)) nomes.add(m[1]);
  for (const m of texto.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const parte of m[1].split(',')) {
      const p = parte.trim().split(/\s+as\s+/);
      const nome = (p[1] ?? p[0]).trim();
      if (nome === 'default') temDefault = true; else if (nome) nomes.add(nome);
    }
  }
  const cjs = /\bmodule\.exports\s*=\s*(\{[^}]*\}|[\w$]+)/.exec(texto);
  if (cjs) {
    if (cjs[1].startsWith('{')) for (const p of cjs[1].slice(1, -1).split(',')) { const n = p.split(':')[0].trim(); if (n) nomes.add(n); }
    else temDefault = true;
  }
  for (const m of texto.matchAll(/\b(?:module\.)?exports\.([\w$]+)\s*=/g)) nomes.add(m[1]);
  return { nomes: [...nomes], temDefault, commonjs: /\bmodule\.exports\b|\bexports\.\w/.test(texto) };
}

/**
 * Analisa um erro de módulo.
 * @param {object} info  resultado de interpretarErro
 * @param {string} arquivoImportador  caminho do arquivo que fez o import/require
 * @param {string} texto  conteúdo desse arquivo
 * @param {number|null} linhaSugerida  linha (base 0) informada pelo erro, se houver
 * @returns analise no mesmo formato do analisador, ou null
 */
function analisarModulo(info, arquivoImportador, texto, linhaSugerida) {
  const msg = info.principal;
  const naoAchou = /Cannot find (module|package) '([^']+)'/.exec(msg);
  const semExport = /The requested module '([^']+)' does not provide an export named '([^']+)'/.exec(msg);
  if (!naoAchou && !semExport) return null;

  const dirBase = path.dirname(paraCaminho(arquivoImportador));
  const imports = importsDoArquivo(texto);

  if (semExport) {
    const [, esp, nome] = semExport;
    const imp = imports.find((i) => i.especificador === esp && (linhaSugerida === null || i.linha === linhaSugerida)) ?? imports.find((i) => i.especificador === esp);
    const alvoArq = ehRelativo(esp) ? resolver(dirBase, esp) : null;
    const local = imp ? (() => {
      const l = texto.split(/\r?\n/)[imp.linha];
      const c = l.search(new RegExp(`\\b${nome.replace(/\$/g, '\\$')}\\b`));
      return c >= 0 ? { linha: imp.linha, col: c, fimCol: c + nome.length } : { linha: imp.linha, col: imp.col, fimCol: imp.fimCol };
    })() : null;
    if (!alvoArq) {
      return { causa: `${codigo(esp)} não exporta ${nome === 'default' ? 'um export default' : codigo(nome)}.`, local, refs: ['import', 'export'] };
    }
    const exp = exportsDoArquivo(fs.readFileSync(alvoArq, 'utf8'));
    const rel = path.basename(alvoArq);
    if (nome === 'default') {
      return {
        causa: `${codigo(rel)} não tem ${codigo('export default')}, então ${codigo(`import algo from '${esp}'`)} (sem chaves) não funciona.`,
        local,
        dica: exp.nomes.length
          ? `Ele exporta: ${exp.nomes.map(codigo).join(', ')}. Importe com chaves: ${codigo(`import { ${exp.nomes[0]} } from '${esp}'`)}, ou adicione ${codigo('export default')} no arquivo.`
          : `${exp.commonjs ? `Ele usa ${codigo('module.exports')} (CommonJS): ` : ''}adicione ${codigo('export default ...')} ou ${codigo('export { ... }')} em ${codigo(rel)}.`,
        refs: ['import', 'export'],
      };
    }
    const parecido = maisParecida(nome, exp.nomes);
    const dica = parecido
      ? `${codigo(rel)} exporta ${codigo(parecido)} — provavelmente é esse o nome (maiúsculas contam).`
      : exp.temDefault && !exp.nomes.length
        ? `${codigo(rel)} só tem ${codigo('export default')}: importe SEM chaves: ${codigo(`import ${nome} from '${esp}'`)}.`
        : exp.nomes.length
          ? `${codigo(rel)} exporta: ${exp.nomes.map(codigo).join(', ')}.${exp.temDefault ? ` E também tem ${codigo('export default')} (importe sem chaves).` : ''}`
          : `${codigo(rel)} não exporta nada${exp.commonjs ? ` no formato de módulo ES (usa ${codigo('module.exports')})` : ''}. Adicione ${codigo(`export class ${nome}`)} / ${codigo(`export { ${nome} }`)} nele.`;
    return {
      causa: `${codigo(rel)} não exporta nada chamado ${codigo(nome)}.`,
      local,
      dica,
      correcao: parecido && local ? { titulo: `Trocar "${nome}" por "${parecido}"`, linha: local.linha, col: local.col, fimLinha: local.linha, fimCol: local.fimCol, texto: parecido } : undefined,
      refs: ['import', 'export'],
    };
  }

  // Cannot find module/package
  const [, oQue, faltando] = naoAchou;
  const faltandoCaminho = paraCaminho(faltando);
  const ehAbsoluto = path.isAbsolute(faltandoCaminho);
  // Acha a linha do import/require correspondente.
  const imp = imports.find((i) => i.especificador === faltando)
    ?? imports.find((i) => ehAbsoluto && ehRelativo(i.especificador) && path.resolve(dirBase, i.especificador).toLowerCase() === faltandoCaminho.toLowerCase())
    ?? imports.find((i) => semExtensao(path.basename(i.especificador)) === semExtensao(path.basename(faltandoCaminho)));
  const esp = imp ? imp.especificador : faltando;
  const local = imp ? { linha: imp.linha, col: imp.col, fimCol: imp.fimCol } : null;

  if (oQue === 'package' || (!ehRelativo(esp) && !ehAbsoluto)) {
    const pacote = esp.startsWith('@') ? esp.split('/').slice(0, 2).join('/') : esp.split('/')[0];
    // Procura um pacote parecido instalado (ex.: "expresss" -> "express")
    let instalados = [];
    for (let d = dirBase; ; d = path.dirname(d)) {
      const nm = path.join(d, 'node_modules');
      if (fs.existsSync(nm)) { instalados = fs.readdirSync(nm).filter((n) => !n.startsWith('.')); break; }
      if (path.dirname(d) === d) break;
    }
    const parecido = maisParecida(pacote, instalados);
    return {
      causa: parecido
        ? `O pacote ${codigo(pacote)} não existe — provavelmente é ${codigo(parecido)} (que está instalado).`
        : `O pacote ${codigo(pacote)} não está instalado neste projeto.`,
      local,
      dica: parecido
        ? `Corrija o nome no ${imp && imp.ehImport ? 'import' : 'require'}.`
        : `Rode ${codigo(`npm install ${pacote}`)} no terminal, na pasta do projeto (onde está o package.json). Se o nome estiver errado, corrija-o.`,
      correcao: parecido && local ? { titulo: `Trocar "${pacote}" por "${parecido}"`, linha: local.linha, col: local.col, fimLinha: local.linha, fimCol: local.col + pacote.length, texto: parecido } : undefined,
      refs: [],
    };
  }

  // Caminho relativo
  const alvo = path.resolve(dirBase, esp);
  const pasta = path.dirname(alvo);
  const nomeArq = path.basename(alvo);
  if (!fs.existsSync(pasta)) {
    return {
      causa: `A pasta ${codigo(path.relative(dirBase, pasta) || '.')} não existe (caminho ${codigo(esp)} a partir de ${codigo(path.basename(arquivoImportador))}).`,
      local,
      dica: `Lembre: ${codigo('./')} é a pasta do arquivo atual e ${codigo('../')} sobe uma pasta. Este arquivo está em ${codigo(path.basename(dirBase))}.`,
      refs: ['import'],
    };
  }
  // ESM: arquivo existe, só faltou a extensão
  if (imp && imp.ehImport && !/\.[a-z]+$/i.test(nomeArq)) {
    const comExt = EXTENSOES.find((e) => fs.existsSync(alvo + e));
    if (comExt) {
      return {
        causa: `No ${codigo('import')} de módulos ES a extensão do arquivo é obrigatória: falta ${codigo(comExt)} em ${codigo(esp)}.`,
        local,
        dica: `Escreva ${codigo(`'${esp}${comExt}'`)}. (Só o ${codigo('require')} do CommonJS completa a extensão sozinho.)`,
        correcao: local ? { titulo: `Adicionar "${comExt}" no import`, linha: local.linha, col: local.fimCol, fimLinha: local.linha, fimCol: local.fimCol, texto: comExt } : undefined,
        refs: ['import'],
      };
    }
  }
  const arquivos = fs.readdirSync(pasta);
  const temExt = /\.[a-z]+$/i.test(nomeArq);
  const candidatos = temExt ? arquivos : arquivos.map(semExtensao);
  const parecido = maisParecida(temExt ? nomeArq : semExtensao(nomeArq), [...new Set(candidatos)]);
  const novoEsp = parecido ? esp.slice(0, esp.length - nomeArq.length) + parecido : null;
  return {
    causa: parecido
      ? `O arquivo ${codigo(nomeArq)} não existe em ${codigo(path.basename(pasta))}; existe ${codigo(parecido)} — provavelmente é esse.`
      : `O arquivo ${codigo(nomeArq)} não existe na pasta ${codigo(path.basename(pasta))}.`,
    local,
    dica: parecido
      ? `Use ${codigo(`'${novoEsp}'`)}. Maiúsculas e minúsculas contam (no Windows pode até funcionar, mas quebra no Linux/servidor).`
      : `Arquivos nessa pasta: ${arquivos.slice(0, 8).map(codigo).join(', ')}${arquivos.length > 8 ? '...' : ''}.`,
    correcao: parecido && local ? { titulo: `Trocar para "${novoEsp}"`, linha: local.linha, col: local.col, fimLinha: local.linha, fimCol: local.fimCol, texto: novoEsp } : undefined,
    refs: ['import'],
  };
}

module.exports = { analisarModulo, importsDoArquivo, exportsDoArquivo };
