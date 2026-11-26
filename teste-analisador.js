// Teste do analisador de causa: node teste-analisador.js
// Cada caso usa a mensagem e a posição REAIS que o TypeScript (motor de JS do VS Code) gera.
// Linhas e colunas começam em 1, como aparecem no editor.
const { analisar } = require('./analisador');

const casos = [
  // [título, código, [linha, coluna, mensagem], trecho esperado na causa, [linha, coluna] esperados do local]
  ['findAll do Sequelize não vira finally', 'function buscarTodos() {\n  return Usuario.findAll();\n}', [2, 18, 'TypeError: Usuario.findAll is not a function'], 'é um método de bibliotecas de banco de dados', [2, 18]],
  ['funtion escrito errado', 'funtion somar(a, b) {\n  return a + b;\n}', [1, 21, "';' expected."], '`funtion` está escrito errado', [1, 1]],
  ['asnyc em arrow', 'const f = asnyc () => {};', [1, 20, "';' expected."], '`asnyc` está escrito errado: o certo é `async`', [1, 11]],
  ['awiat', 'async function f() {\n  const r = awiat fetch("/x");\n}', [2, 19, "',' expected."], 'o certo é `await`', [2, 13]],
  ['elseif', 'let x = 1;\nif (x) {} elseif (x) {}', [2, 22, "';' expected."], '`else if`', [2, 11]],
  ['If maiúsculo', 'let x = 1;\nIf (x > 0) {\n  console.log(x);\n}', [2, 12, "';' expected."], 'letra maiúscula', [2, 1]],
  ['cosnt (declaração)', 'cosnt nome = "Ana";\nconsole.log(nome);', [1, 1, "Unknown keyword or identifier. Did you mean 'const'?"], '`cosnt` está escrito errado', [1, 1]],
  ['nome criado com cosnt', 'cosnt nome = "Ana";\nconsole.log(nome);', [2, 13, "Cannot find name 'nome'."], 'não foi criada porque', [1, 1]],
  ['await sem async', 'function carregar() {\n  const r = await fetch("/api");\n  return r;\n}', [2, 13, "'await' expressions are only allowed within async functions and at the top levels of modules."], 'não é async', [1, 1]],
  ['await em arrow', 'const f = () => {\n  await fetch("/x");\n};', [2, 3, "'await' expressions are only allowed within async functions and at the top levels of modules."], 'não é async', [1, 11]],
  ['await no forEach', 'async function f(lista) {\n  lista.forEach(item => {\n    await salvar(item);\n  });\n}', [3, 5, "'await' expressions are only allowed within async functions and at the top levels of modules."], '`forEach`', [2, 17]],
  ['await no map', 'async function f(ids) {\n  const r = ids.map((id) => await buscar(id));\n}', [2, 29, "'await' expressions are only allowed within async functions and at the top levels of modules."], '`map`', [2, 21]],
  ['await em then', 'fetch("/x").then(function (r) {\n  const d = await r.json();\n});', [2, 13, "'await' expressions are only allowed within async functions and at the top levels of modules."], '`then`', [1, 18]],
  ['await em método', 'class A {\n  carregar() {\n    return await fetch("/x");\n  }\n}', [3, 12, "'await' expressions are only allowed within async functions and at the top levels of modules."], 'não é async', [2, 3]],
  ['await no topo', 'const r = await fetch("/x");', [1, 11, "'await' expressions are only allowed at the top level of a file when that file is a module, but this file has no imports or exports. Consider adding an empty 'export {}' to make this file a module."], 'fora de qualquer função', [1, 11]],
  ['falta ) antes do ;', 'console.log("oi";\nlet x = 1;', [1, 17, "')' expected."], 'falta `)`', [1, 12]],
  ['falta ] antes do ;', 'const a = [1, 2, 3;\n', [1, 19, "',' expected."], 'falta `]`', [1, 11]],
  ['falta ) no if', 'let x = 1;\nif (x > 0 {\n  console.log(x);\n}', [2, 11, "')' expected."], 'falta `)`', [2, 4]],
  ['falta } (pela indentação)', 'function f() {\n  if (true) {\n    console.log(1);\n\n}\n', [6, 1, "'}' expected."], 'A chave `{` aberta na linha 2', [2, 13]],
  ['falta ) no fim do arquivo', 'function f() {\n  return 1;\n}\nconsole.log("oi"', [4, 17, "')' expected."], 'falta `)`', [4, 12]],
  ['} sobrando', 'function f() {\n  return 1;\n}\n}', [4, 1, 'Declaration or statement expected.'], 'está sobrando', [4, 1]],
  ['falta vírgula no objeto', 'const p = {\n  nome: "Ana"\n  idade: 3\n};', [3, 3, "',' expected."], 'Falta uma vírgula `,` no fim da linha 2', [2, 14]],
  ['falta + entre textos', 'const n = "a";\nconsole.log("Olá" n);', [2, 19, "',' expected."], 'falta `+`', [2, 13]],
  ['string não fechada', 'const s = "abc;\nconsole.log(s);', [1, 16, 'Unterminated string literal.'], 'não foi fechado', [1, 11]],
  ['aspas curvas', 'const s = “oi”;', [1, 11, 'Invalid character.'], 'aspas curvas', [1, 11]],
  ['seta separada', 'const f = (a, b) = > a + b;', [1, 20, 'Expression expected.'], '`=>`', [1, 18]],
  ['if sem parênteses', 'if x > 1 {\n}', [1, 4, "'(' expected."], 'entre parênteses', [1, 1]],
  ['palavra reservada como nome', 'let class = 1;', [1, 1, 'Variable declaration not allowed at this location.'], 'palavra reservada', [1, 5]],
  ['vírgula a mais', 'function f(a,, b) {}', [1, 14, 'Parameter declaration expected.'], 'vírgula', [1, 14]],
  ['operador sem valor', 'if (a == ) {}', [1, 10, 'Expression expected.'], 'Falta o valor depois do `==`', [1, 7]],
  ['função sem nome', 'function () {}', [1, 10, 'Identifier expected.'], 'não tem nome', [1, 1]],
  ['const reatribuída', 'const a = 1;\na = 2;', [2, 1, "Cannot assign to 'a' because it is a constant."], 'criada com `const` na linha 1', [1, 1]],
  ['let redeclarado', 'let a = 1;\nlet a = 2;', [1, 5, "Cannot redeclare block-scoped variable 'a'."], 'mais de uma vez', [2, 5]],
  ['usada antes de criar', 'console.log(b);\nlet b = 1;', [1, 13, "Block-scoped variable 'b' used before its declaration."], 'antes da linha', [2, 1]],
  ['console.lg', 'console.lg("oi");', [1, 9, "Property 'lg' does not exist on type 'Console'."], 'o certo é `log`', [1, 9]],
  ['than -> then', 'fetch("/x").than(r => r.json());', [1, 13, "Property 'than' does not exist on type 'Promise<Response>'."], 'o certo é `then`', [1, 13]],
  ['psuh -> push', 'const l = [1];\nl.psuh(2);', [2, 3, "Property 'psuh' does not exist on type 'number[]'."], 'o certo é `push`', [2, 3]],
  ['json sem await', 'async function f() {\n  const r = fetch("/x");\n  const d = r.json();\n}', [3, 15, "Property 'json' does not exist on type 'Promise<Response>'."], 'falta `await`', [3, 15]],
  ['getElementByID', 'document.getElementByID("x");', [1, 10, "Property 'getElementByID' does not exist on type 'Document'. Did you mean 'getElementById'?"], 'maiúsculas/minúsculas', [1, 10]],
  ['setTimeOut', 'setTimeOut(() => {}, 100);', [1, 1, "Cannot find name 'setTimeOut'. Did you mean 'setTimeout'?"], '`setTimeout`', [1, 1]],
  ['funtion (TS sugere Function)', 'funtion somar() {}', [1, 1, "Cannot find name 'funtion'. Did you mean 'Function'?"], 'o certo é `function`', [1, 1]],
  // Casos que NÃO devem inventar causa:
  ['variável curta parecida com keyword', 'let lat = 1;\nlet fro = 2;\nconsole.log(lat fro);', [3, 17, "',' expected."], 'lado a lado', [3, 13]],
  ['await já em função async', 'async function f() {\n  const x = () => 1;\n  await fetch("/x");\n}', [3, 3, "'await' expressions are only allowed within async functions and at the top levels of modules."], null, null],
];

let falhas = 0;
for (const [titulo, codigo, [linha, coluna, mensagem], esperado, local] of casos) {
  const r = analisar(codigo, { linha: linha - 1, coluna: coluna - 1, mensagem });
  let erro = null;
  if (esperado === null) {
    if (r) erro = `não deveria ter causa, mas deu: ${r.causa}`;
  } else if (!r) {
    erro = 'nenhuma causa encontrada';
  } else if (!r.causa.includes(esperado)) {
    erro = `causa diferente: ${r.causa}`;
  } else if (local && (!r.local || r.local.linha !== local[0] - 1 || r.local.col !== local[1] - 1)) {
    erro = `local diferente: esperado ${local[0]}:${local[1]}, veio ${r.local ? `${r.local.linha + 1}:${r.local.col + 1}` : 'nenhum'}`;
  }
  if (erro) {
    falhas++;
    console.log(`✘ ${titulo}\n    ${erro}`);
  } else {
    console.log(`✔ ${titulo}${r ? `\n    ${r.causa}` : ''}`);
  }
}
console.log(`\n${casos.length - falhas}/${casos.length} casos corretos.`);
process.exitCode = falhas ? 1 : 0;
