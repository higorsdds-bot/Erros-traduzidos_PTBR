// Teste rápido do dicionário: node teste-dicionario.js
const { traduzirLocal } = require('./tradutor');

const exemplos = [
  "Cannot find name 'consle'. Did you mean 'console'?",
  "'}' expected.",
  "';' expected.",
  "Expected 2 arguments, but got 1.",
  "Property 'nome' does not exist on type 'Pessoa'.",
  "Argument of type 'string' is not assignable to parameter of type 'number'.",
  "'x' is declared but its value is never read.",
  'Import "numpy" could not be resolved',
  '"variavel" is not defined',
  'Expected indented block',
  '"(" was not closed',
  'nome cannot be resolved to a variable',
  'Syntax error, insert "}" to complete ClassBody',
  'Syntax error on token ")", ; expected',
  'The method printn(String) is undefined for the type PrintStream',
  'Cannot make a static reference to the non-static method somar(int, int)',
  "Undefined variable '$usuario'.",
  "Syntax error: unexpected token '}', expecting ';'.",
  'Parsing error: Unexpected token )',
  'Mensagem que não está no dicionário',
];

let ok = 0;
for (const e of exemplos) {
  const t = traduzirLocal(e);
  if (t) ok++;
  console.log(`EN: ${e}\nPT: ${t ?? '(não encontrado -> iria para tradução online)'}\n`);
}
console.log(`${ok}/${exemplos.length} traduzidos pelo dicionário.`);
