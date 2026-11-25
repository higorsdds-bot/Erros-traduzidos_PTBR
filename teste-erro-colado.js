// Teste da leitura de erros colados do terminal/console: node teste-erro-colado.js
// As saídas abaixo foram copiadas de execuções reais (Node 24, Chrome, Python 3.12); só os caminhos foram encurtados.
const { interpretarErro, colunaNoArquivo } = require('./erro-colado');
const { analisar } = require('./analisador');
const { traduzirLocal } = require('./tradutor');

const casos = [
  {
    titulo: 'Node: await fora de async (erro de sintaxe)',
    saida: 'C:\\proj\\await.js:2\n  const r = await fetch("/x");\n            ^^^^^\n\nSyntaxError: await is only valid in async functions and the top level bodies of modules\n    at wrapSafe (node:internal/modules/cjs/loader:1692:18)\n\nNode.js v24.13.0',
    arquivo: 'function carregar() {\n  const r = await fetch("/x");\n}\n',
    local: ['C:\\proj\\await.js', 2, 13],
    causa: 'não é async',
  },
  {
    titulo: 'Node: funtion (o Node aponta para "somar")',
    saida: 'C:\\proj\\funtion.js:1\nfuntion somar(a, b) {\n        ^^^^^\n\nSyntaxError: Unexpected identifier \'somar\'\n    at wrapSafe (node:internal/modules/cjs/loader:1692:18)',
    arquivo: 'funtion somar(a, b) {\n  return a + b;\n}\n',
    local: ['C:\\proj\\funtion.js', 1, 9],
    causa: '`funtion` está escrito errado',
  },
  {
    titulo: 'Node: propriedade de undefined',
    saida: "C:\\proj\\undef.js:2\nconst nomes = dados.itens.map((x) => x.nome);\n                          ^\n\nTypeError: Cannot read properties of undefined (reading 'map')\n    at Object.<anonymous> (C:\\proj\\undef.js:2:27)\n    at Module._compile (node:internal/modules/cjs/loader:1761:14)",
    arquivo: 'const dados = {};\nconst nomes = dados.itens.map((x) => x.nome);\n',
    local: ['C:\\proj\\undef.js', 2, 27],
    causa: '`dados.itens` está `undefined`',
  },
  {
    titulo: 'Node: método de array em objeto',
    saida: 'C:\\proj\\notfn.js:3\n  return lista.map((x) => x);\n               ^\n\nTypeError: lista.map is not a function\n    at f (C:\\proj\\notfn.js:3:16)\n    at Object.<anonymous> (C:\\proj\\notfn.js:5:1)',
    arquivo: 'const lista = { a: 1 };\nfunction f() {\n  return lista.map((x) => x);\n}\nf();\n',
    local: ['C:\\proj\\notfn.js', 3, 16],
    causa: '`lista` não é um array',
  },
  {
    titulo: 'Node: const reatribuída',
    saida: 'C:\\proj\\const.js:2\ntotal = 2;\n      ^\n\nTypeError: Assignment to constant variable.\n    at Object.<anonymous> (C:\\proj\\const.js:2:7)',
    arquivo: 'const total = 1;\ntotal = 2;\n',
    local: ['C:\\proj\\const.js', 2, 7],
    causa: 'criada com `const` na linha 1',
  },
  {
    titulo: 'Node: chave não fechada (fim do arquivo)',
    saida: 'C:\\proj\\chave.js:6\n\n\n\nSyntaxError: Unexpected end of input\n    at wrapSafe (node:internal/modules/cjs/loader:1692:18)',
    arquivo: 'function f() {\n  if (true) {\n    console.log(1);\n\n}\n',
    local: ['C:\\proj\\chave.js', 6, null],
    causa: 'A chave `{` aberta na linha 2',
  },
  {
    titulo: 'Navegador (Chrome): erro com URL na pilha',
    saida: "Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')\n    at http://127.0.0.1:5500/js/app.js:3:8",
    arquivo: 'const botao = document.getElementById("enviar");\n\nbotao.addEventListener("click", () => {});\n',
    local: ['http://127.0.0.1:5500/js/app.js', 3, 8],
    causa: '`botao` está `null`',
  },
  {
    titulo: 'Python: nome não definido',
    saida: 'Traceback (most recent call last):\n  File "C:\\proj\\prog.py", line 4, in <module>\n    print(nmoe)\n          ^^^^\nNameError: name \'nmoe\' is not defined. Did you mean: \'nome\'?',
    local: ['C:\\proj\\prog.py', 4, null],
    traducao: "O nome 'nmoe' não existe",
  },
  {
    titulo: 'Python: ignora frames de bibliotecas',
    saida: 'Traceback (most recent call last):\n  File "C:\\proj\\app.py", line 7, in <module>\n    dados = requests.get(url).json()\n  File "C:\\Python312\\Lib\\site-packages\\requests\\models.py", line 978, in json\n    raise RequestsJSONDecodeError(e.msg, e.doc, e.pos)\nrequests.exceptions.JSONDecodeError: Expecting value: line 1 column 1 (char 0)',
    local: ['C:\\proj\\app.py', 7, null],
  },
  {
    titulo: 'Só a mensagem (sem arquivo)',
    saida: 'TypeError: obj is not iterable',
    local: null,
    traducao: 'não é iterável',
  },
];

let falhas = 0;
for (const c of casos) {
  const info = interpretarErro(c.saida);
  const erros = [];
  if (c.local === null) {
    if (info.local) erros.push(`não deveria ter local, veio ${info.local.caminho}`);
  } else if (!info.local) {
    erros.push('local não encontrado');
  } else {
    const [caminho, linha, coluna] = c.local;
    if (info.local.caminho !== caminho || info.local.linha !== linha) erros.push(`local ${info.local.caminho}:${info.local.linha}`);
    if (coluna !== null && info.local.coluna !== coluna) erros.push(`coluna ${info.local.coluna} (esperada ${coluna})`);
  }
  if (c.causa) {
    const linhaArq = c.arquivo.split('\n')[info.local.linha - 1];
    const col = colunaNoArquivo(info.local, linhaArq) ?? 1;
    const r = analisar(c.arquivo, { linha: info.local.linha - 1, coluna: col - 1, mensagem: info.principal });
    if (!r || !r.causa.includes(c.causa)) erros.push(`causa: ${r ? r.causa : 'nenhuma'}`);
  }
  if (c.traducao) {
    const t = traduzirLocal(info.principal);
    if (!t || !t.includes(c.traducao)) erros.push(`tradução: ${t}`);
  }
  if (erros.length) { falhas++; console.log(`✘ ${c.titulo}\n    ${erros.join('\n    ')}`); } else console.log(`✔ ${c.titulo}`);
}
console.log(`\n${casos.length - falhas}/${casos.length} casos corretos.`);
process.exitCode = falhas ? 1 : 0;
