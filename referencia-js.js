// Referência rápida de JavaScript em português (baseada na MDN:
// https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference).
// Usada no hover para explicar palavras-chave e funções prontas que aparecem nos erros.

const MDN = 'https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/';
const MDN_API = 'https://developer.mozilla.org/pt-BR/docs/Web/API/';

// nome -> { resumo, sintaxe, exemplo, url }
const referencia = {
  // ---------------- palavras-chave / instruções ----------------
  'async': {
    resumo: 'Marca uma função como assíncrona. Ela sempre devolve uma Promise e pode usar `await` dentro dela.',
    sintaxe: 'async function nome() { ... }  |  const f = async () => { ... }',
    exemplo: 'async function carregar() {\n  const resposta = await fetch("/api");\n  return resposta.json();\n}',
    url: MDN + 'Statements/async_function',
  },
  'await': {
    resumo: 'Espera uma Promise terminar e devolve o resultado. Só pode ser usado dentro de uma função `async` (ou no nível principal de um módulo).',
    sintaxe: 'const valor = await promessa;',
    exemplo: 'async function main() {\n  try {\n    const dados = await buscarDados();\n  } catch (erro) {\n    console.error(erro);\n  }\n}',
    url: MDN + 'Operators/await',
  },
  'function': {
    resumo: 'Declara uma função (um bloco de código reutilizável que pode receber parâmetros e devolver um valor).',
    sintaxe: 'function nome(param1, param2) { ... return valor; }',
    exemplo: 'function somar(a, b) {\n  return a + b;\n}',
    url: MDN + 'Statements/function',
  },
  '=>': {
    resumo: 'Arrow function: forma curta de escrever uma função. A seta `=>` é escrita junta, sem espaço.',
    sintaxe: '(param1, param2) => expressão  |  (param) => { ... }',
    exemplo: 'const dobro = (n) => n * 2;\nconst somar = (a, b) => {\n  return a + b;\n};',
    url: MDN + 'Functions/Arrow_functions',
  },
  'const': {
    resumo: 'Declara uma constante: precisa receber um valor na declaração e não pode ser reatribuída.',
    sintaxe: 'const nome = valor;',
    exemplo: 'const PI = 3.14;',
    url: MDN + 'Statements/const',
  },
  'let': {
    resumo: 'Declara uma variável que pode mudar de valor e só existe dentro do bloco { } onde foi criada.',
    sintaxe: 'let nome = valor;',
    exemplo: 'let contador = 0;\ncontador = contador + 1;',
    url: MDN + 'Statements/let',
  },
  'var': {
    resumo: 'Forma antiga de declarar variável. Prefira `let` ou `const`.',
    sintaxe: 'var nome = valor;',
    exemplo: 'let nome = "Ana"; // prefira let/const',
    url: MDN + 'Statements/var',
  },
  'return': {
    resumo: 'Encerra a função e devolve um valor para quem a chamou. Só pode ser usado dentro de uma função.',
    sintaxe: 'return valor;',
    exemplo: 'function dobro(n) {\n  return n * 2;\n}',
    url: MDN + 'Statements/return',
  },
  'if': {
    resumo: 'Executa um bloco só se a condição for verdadeira. A condição fica SEMPRE entre parênteses.',
    sintaxe: 'if (condição) { ... } else if (outra) { ... } else { ... }',
    exemplo: 'if (idade >= 18) {\n  console.log("maior");\n} else {\n  console.log("menor");\n}',
    url: MDN + 'Statements/if...else',
  },
  'else': {
    resumo: 'Bloco executado quando a condição do `if` é falsa. Para outra condição use `else if` (separado).',
    sintaxe: 'if (a) { ... } else if (b) { ... } else { ... }',
    exemplo: 'if (nota >= 7) {\n  console.log("aprovado");\n} else if (nota >= 5) {\n  console.log("recuperação");\n} else {\n  console.log("reprovado");\n}',
    url: MDN + 'Statements/if...else',
  },
  'for': {
    resumo: 'Laço de repetição. Para percorrer listas, `for...of` é o mais simples (e funciona com `await`).',
    sintaxe: 'for (let i = 0; i < n; i++) { ... }  |  for (const item of lista) { ... }',
    exemplo: 'for (const nome of nomes) {\n  console.log(nome);\n}',
    url: MDN + 'Statements/for...of',
  },
  'while': {
    resumo: 'Repete o bloco enquanto a condição for verdadeira.',
    sintaxe: 'while (condição) { ... }',
    exemplo: 'let i = 0;\nwhile (i < 3) {\n  i++;\n}',
    url: MDN + 'Statements/while',
  },
  'switch': {
    resumo: 'Escolhe um bloco de acordo com o valor. Cada `case` normalmente termina com `break`.',
    sintaxe: 'switch (valor) { case 1: ...; break; default: ... }',
    exemplo: 'switch (dia) {\n  case 0:\n    console.log("domingo");\n    break;\n  default:\n    console.log("outro dia");\n}',
    url: MDN + 'Statements/switch',
  },
  'break': {
    resumo: 'Sai de um laço (for/while) ou de um switch. Fora deles é erro.',
    sintaxe: 'break;',
    exemplo: 'for (const n of numeros) {\n  if (n < 0) break;\n}',
    url: MDN + 'Statements/break',
  },
  'continue': {
    resumo: 'Pula para a próxima repetição do laço. Só pode ser usado dentro de um laço.',
    sintaxe: 'continue;',
    exemplo: 'for (const n of numeros) {\n  if (n % 2 === 0) continue;\n  console.log(n);\n}',
    url: MDN + 'Statements/continue',
  },
  'try': {
    resumo: 'Tenta executar um bloco; se der erro, o `catch` trata. Use com `await` para tratar falhas de Promises.',
    sintaxe: 'try { ... } catch (erro) { ... } finally { ... }',
    exemplo: 'try {\n  const dados = JSON.parse(texto);\n} catch (erro) {\n  console.error("JSON inválido", erro);\n}',
    url: MDN + 'Statements/try...catch',
  },
  'catch': {
    resumo: '`catch` trata o erro de um `try` (ou de uma Promise com `.catch()`). Precisa vir logo depois de um `try { }`.',
    sintaxe: 'try { ... } catch (erro) { ... }  |  promessa.catch((erro) => { ... })',
    exemplo: 'fetch("/api")\n  .then((r) => r.json())\n  .catch((erro) => console.error(erro));',
    url: MDN + 'Statements/try...catch',
  },
  'throw': {
    resumo: 'Lança um erro, interrompendo a execução até um `catch`.',
    sintaxe: 'throw new Error("mensagem");',
    exemplo: 'if (!nome) {\n  throw new Error("nome é obrigatório");\n}',
    url: MDN + 'Statements/throw',
  },
  'class': {
    resumo: 'Declara uma classe (um molde para criar objetos com `new`).',
    sintaxe: 'class Nome { constructor(x) { this.x = x; } metodo() { ... } }',
    exemplo: 'class Pessoa {\n  constructor(nome) {\n    this.nome = nome;\n  }\n  falar() {\n    return "Olá, " + this.nome;\n  }\n}',
    url: MDN + 'Classes',
  },
  'new': {
    resumo: 'Cria um objeto a partir de uma classe ou construtor.',
    sintaxe: 'const obj = new Classe(argumentos);',
    exemplo: 'const hoje = new Date();',
    url: MDN + 'Operators/new',
  },
  'typeof': {
    resumo: 'Devolve o tipo de um valor como texto: "string", "number", "boolean", "object", "function", "undefined"...',
    sintaxe: 'typeof valor',
    exemplo: 'if (typeof idade === "number") { ... }',
    url: MDN + 'Operators/typeof',
  },
  'import': {
    resumo: 'Importa algo de outro arquivo/módulo. Só pode ficar no topo do arquivo (fora de funções e blocos).',
    sintaxe: 'import { nome } from "./arquivo.js";',
    exemplo: 'import { somar } from "./matematica.js";',
    url: MDN + 'Statements/import',
  },
  'export': {
    resumo: 'Exporta algo para ser usado em outros arquivos. Só pode ficar no topo do arquivo.',
    sintaxe: 'export function nome() { ... }  |  export default valor;',
    exemplo: 'export function somar(a, b) {\n  return a + b;\n}',
    url: MDN + 'Statements/export',
  },

  // ---------------- Promises / assíncrono ----------------
  'Promise': {
    resumo: 'Representa um valor que vai chegar no futuro (ou falhar). Use `await` ou `.then()` para pegar o resultado.',
    sintaxe: 'new Promise((resolve, reject) => { ... })',
    exemplo: 'const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));\nawait espera(1000);',
    url: MDN + 'Global_Objects/Promise',
  },
  'then': {
    resumo: 'Registra o que fazer quando a Promise terminar com sucesso. Devolve outra Promise (pode encadear).',
    sintaxe: 'promessa.then((resultado) => { ... })',
    exemplo: 'fetch("/api")\n  .then((resposta) => resposta.json())\n  .then((dados) => console.log(dados));',
    url: MDN + 'Global_Objects/Promise/then',
  },
  'finally': {
    resumo: 'Executa no fim, dando certo ou errado (em `try` ou em Promise).',
    sintaxe: 'promessa.finally(() => { ... })',
    exemplo: 'carregar().finally(() => esconderCarregando());',
    url: MDN + 'Global_Objects/Promise/finally',
  },
  'Promise.all': {
    resumo: 'Espera várias Promises ao mesmo tempo e devolve um array com os resultados (falha se uma falhar).',
    sintaxe: 'const resultados = await Promise.all([p1, p2]);',
    exemplo: 'const usuarios = await Promise.all(ids.map((id) => buscarUsuario(id)));',
    url: MDN + 'Global_Objects/Promise/all',
  },
  'fetch': {
    resumo: 'Faz uma requisição HTTP e devolve uma Promise com a resposta. Use `await` (ou `.then`) e depois `.json()`.',
    sintaxe: 'const resposta = await fetch(url, opções);',
    exemplo: 'const resposta = await fetch("https://api.exemplo.com/itens");\nconst itens = await resposta.json();',
    url: MDN_API + 'Fetch_API/Using_Fetch',
  },
  'json': {
    resumo: '`resposta.json()` lê o corpo da resposta do fetch como JSON. Também devolve uma Promise: precisa de `await`.',
    sintaxe: 'const dados = await resposta.json();',
    exemplo: 'const resposta = await fetch("/api");\nconst dados = await resposta.json();',
    url: MDN_API + 'Response/json',
  },
  'setTimeout': {
    resumo: 'Executa uma função uma vez, depois de um tempo em milissegundos. Atenção ao "T" maiúsculo só em Timeout.',
    sintaxe: 'setTimeout(funcao, milissegundos)',
    exemplo: 'setTimeout(() => {\n  console.log("1 segundo depois");\n}, 1000);',
    url: MDN_API + 'Window/setTimeout',
  },
  'setInterval': {
    resumo: 'Executa uma função repetidamente, a cada intervalo em milissegundos. Pare com clearInterval.',
    sintaxe: 'const id = setInterval(funcao, milissegundos);',
    exemplo: 'const id = setInterval(() => console.log("tic"), 1000);\nclearInterval(id);',
    url: MDN_API + 'Window/setInterval',
  },

  // ---------------- console / JSON / números ----------------
  'console': {
    resumo: 'Objeto para mostrar mensagens no console: log, error, warn, table...',
    sintaxe: 'console.log(valor1, valor2)',
    exemplo: 'console.log("Olá", nome);\nconsole.error("Algo deu errado");',
    url: MDN_API + 'console',
  },
  'log': {
    resumo: '`console.log` mostra valores no console.',
    sintaxe: 'console.log(valor1, valor2, ...)',
    exemplo: 'console.log("Total:", total);',
    url: MDN_API + 'console/log_static',
  },
  'JSON.parse': {
    resumo: 'Converte um texto JSON em objeto JavaScript. Lança erro se o texto não for JSON válido.',
    sintaxe: 'const obj = JSON.parse(texto);',
    exemplo: 'const pessoa = JSON.parse(\'{"nome":"Ana"}\');',
    url: MDN + 'Global_Objects/JSON/parse',
  },
  'JSON.stringify': {
    resumo: 'Converte um objeto JavaScript em texto JSON.',
    sintaxe: 'const texto = JSON.stringify(obj);',
    exemplo: 'localStorage.setItem("pessoa", JSON.stringify(pessoa));',
    url: MDN + 'Global_Objects/JSON/stringify',
  },
  'parseInt': {
    resumo: 'Converte texto em número inteiro. Se não der, devolve NaN.',
    sintaxe: 'parseInt(texto, 10)',
    exemplo: 'const idade = parseInt("42", 10); // 42',
    url: MDN + 'Global_Objects/parseInt',
  },
  'parseFloat': {
    resumo: 'Converte texto em número com casas decimais (use ponto, não vírgula).',
    sintaxe: 'parseFloat(texto)',
    exemplo: 'const preco = parseFloat("19.90");',
    url: MDN + 'Global_Objects/parseFloat',
  },
  'Number': {
    resumo: 'Converte um valor em número (`Number("12")` → 12). Também tem métodos como Number.isInteger.',
    sintaxe: 'Number(valor)',
    exemplo: 'const n = Number(campo.value);',
    url: MDN + 'Global_Objects/Number',
  },
  'toFixed': {
    resumo: 'Formata um número com uma quantidade fixa de casas decimais (devolve texto).',
    sintaxe: 'numero.toFixed(casas)',
    exemplo: '(3.14159).toFixed(2); // "3.14"',
    url: MDN + 'Global_Objects/Number/toFixed',
  },
  'Math': {
    resumo: 'Funções matemáticas prontas: Math.round, Math.floor, Math.ceil, Math.random, Math.max, Math.min, Math.abs, Math.sqrt...',
    sintaxe: 'Math.funcao(valor)',
    exemplo: 'const sorteio = Math.floor(Math.random() * 10); // 0 a 9',
    url: MDN + 'Global_Objects/Math',
  },

  // ---------------- arrays ----------------
  'length': {
    resumo: 'Quantidade de itens de um array ou de caracteres de um texto. É propriedade (sem parênteses). Escreve-se l-e-n-g-t-h.',
    sintaxe: 'lista.length',
    exemplo: 'console.log(nomes.length);',
    url: MDN + 'Global_Objects/Array/length',
  },
  'push': {
    resumo: 'Adiciona itens no fim do array.',
    sintaxe: 'lista.push(item)',
    exemplo: 'nomes.push("Ana");',
    url: MDN + 'Global_Objects/Array/push',
  },
  'pop': {
    resumo: 'Remove e devolve o último item do array.',
    sintaxe: 'const ultimo = lista.pop();',
    exemplo: 'const ultimo = pilha.pop();',
    url: MDN + 'Global_Objects/Array/pop',
  },
  'map': {
    resumo: 'Cria um NOVO array transformando cada item. Existe só em arrays (para objetos use Object.keys/values/entries).',
    sintaxe: 'const novo = lista.map((item) => ...);',
    exemplo: 'const dobros = numeros.map((n) => n * 2);',
    url: MDN + 'Global_Objects/Array/map',
  },
  'filter': {
    resumo: 'Cria um NOVO array só com os itens que passam no teste.',
    sintaxe: 'const filtrado = lista.filter((item) => condição);',
    exemplo: 'const pares = numeros.filter((n) => n % 2 === 0);',
    url: MDN + 'Global_Objects/Array/filter',
  },
  'reduce': {
    resumo: 'Reduz o array a um único valor (ex.: soma). Sempre passe o valor inicial.',
    sintaxe: 'lista.reduce((acumulador, item) => ..., valorInicial)',
    exemplo: 'const total = precos.reduce((soma, p) => soma + p, 0);',
    url: MDN + 'Global_Objects/Array/reduce',
  },
  'forEach': {
    resumo: 'Executa uma função para cada item. Não devolve nada e NÃO espera `await` — para código assíncrono use for...of.',
    sintaxe: 'lista.forEach((item, indice) => { ... });',
    exemplo: 'nomes.forEach((nome) => console.log(nome));',
    url: MDN + 'Global_Objects/Array/forEach',
  },
  'find': {
    resumo: 'Devolve o primeiro item que passa no teste (ou undefined).',
    sintaxe: 'lista.find((item) => condição)',
    exemplo: 'const ana = pessoas.find((p) => p.nome === "Ana");',
    url: MDN + 'Global_Objects/Array/find',
  },
  'findIndex': {
    resumo: 'Devolve a posição do primeiro item que passa no teste (ou -1).',
    sintaxe: 'lista.findIndex((item) => condição)',
    exemplo: 'const pos = pessoas.findIndex((p) => p.id === 3);',
    url: MDN + 'Global_Objects/Array/findIndex',
  },
  'includes': {
    resumo: 'Verifica se o array (ou texto) contém um valor. Devolve true/false.',
    sintaxe: 'lista.includes(valor)',
    exemplo: 'if (frutas.includes("maçã")) { ... }',
    url: MDN + 'Global_Objects/Array/includes',
  },
  'indexOf': {
    resumo: 'Devolve a posição de um valor no array/texto (ou -1 se não achar).',
    sintaxe: 'lista.indexOf(valor)',
    exemplo: 'const pos = letras.indexOf("c");',
    url: MDN + 'Global_Objects/Array/indexOf',
  },
  'slice': {
    resumo: 'Copia um pedaço do array/texto sem alterar o original.',
    sintaxe: 'lista.slice(inicio, fim)',
    exemplo: 'const primeiros = lista.slice(0, 3);',
    url: MDN + 'Global_Objects/Array/slice',
  },
  'splice': {
    resumo: 'Remove/insere itens no array, ALTERANDO o original.',
    sintaxe: 'lista.splice(inicio, quantosRemover, ...novosItens)',
    exemplo: 'lista.splice(2, 1); // remove o item da posição 2',
    url: MDN + 'Global_Objects/Array/splice',
  },
  'join': {
    resumo: 'Junta os itens do array num texto, com um separador.',
    sintaxe: 'lista.join(separador)',
    exemplo: '["a", "b"].join(", "); // "a, b"',
    url: MDN + 'Global_Objects/Array/join',
  },
  'sort': {
    resumo: 'Ordena o array (altera o original). Para números passe uma função de comparação.',
    sintaxe: 'lista.sort((a, b) => a - b)',
    exemplo: 'numeros.sort((a, b) => a - b);',
    url: MDN + 'Global_Objects/Array/sort',
  },
  'some': {
    resumo: 'Devolve true se ALGUM item passa no teste.',
    sintaxe: 'lista.some((item) => condição)',
    exemplo: 'const temNegativo = numeros.some((n) => n < 0);',
    url: MDN + 'Global_Objects/Array/some',
  },
  'every': {
    resumo: 'Devolve true se TODOS os itens passam no teste.',
    sintaxe: 'lista.every((item) => condição)',
    exemplo: 'const todosPositivos = numeros.every((n) => n > 0);',
    url: MDN + 'Global_Objects/Array/every',
  },
  'Array.isArray': {
    resumo: 'Verifica se um valor é um array.',
    sintaxe: 'Array.isArray(valor)',
    exemplo: 'if (Array.isArray(dados)) { ... }',
    url: MDN + 'Global_Objects/Array/isArray',
  },
  'Array.from': {
    resumo: 'Cria um array a partir de algo "parecido com array" (NodeList, Set, texto...).',
    sintaxe: 'Array.from(valor)',
    exemplo: 'const botoes = Array.from(document.querySelectorAll("button"));',
    url: MDN + 'Global_Objects/Array/from',
  },

  // ---------------- textos ----------------
  'split': {
    resumo: 'Divide um texto em array, usando um separador.',
    sintaxe: 'texto.split(separador)',
    exemplo: '"a,b,c".split(","); // ["a", "b", "c"]',
    url: MDN + 'Global_Objects/String/split',
  },
  'trim': {
    resumo: 'Remove espaços do início e do fim do texto.',
    sintaxe: 'texto.trim()',
    exemplo: 'const nome = campo.value.trim();',
    url: MDN + 'Global_Objects/String/trim',
  },
  'toUpperCase': {
    resumo: 'Converte o texto para MAIÚSCULAS. Note o "U" e o "C" maiúsculos.',
    sintaxe: 'texto.toUpperCase()',
    exemplo: '"ana".toUpperCase(); // "ANA"',
    url: MDN + 'Global_Objects/String/toUpperCase',
  },
  'toLowerCase': {
    resumo: 'Converte o texto para minúsculas. Note o "L" e o "C" maiúsculos.',
    sintaxe: 'texto.toLowerCase()',
    exemplo: '"ANA".toLowerCase(); // "ana"',
    url: MDN + 'Global_Objects/String/toLowerCase',
  },
  'replace': {
    resumo: 'Troca a primeira ocorrência de um trecho do texto (use replaceAll para trocar todas).',
    sintaxe: 'texto.replace(procurar, trocarPor)',
    exemplo: '"1.5".replace(".", ","); // "1,5"',
    url: MDN + 'Global_Objects/String/replace',
  },
  'replaceAll': {
    resumo: 'Troca TODAS as ocorrências de um trecho do texto.',
    sintaxe: 'texto.replaceAll(procurar, trocarPor)',
    exemplo: '"a-b-c".replaceAll("-", " "); // "a b c"',
    url: MDN + 'Global_Objects/String/replaceAll',
  },
  'startsWith': {
    resumo: 'Verifica se o texto começa com um trecho.',
    sintaxe: 'texto.startsWith(trecho)',
    exemplo: 'if (url.startsWith("https")) { ... }',
    url: MDN + 'Global_Objects/String/startsWith',
  },
  'substring': {
    resumo: 'Copia um pedaço do texto entre duas posições.',
    sintaxe: 'texto.substring(inicio, fim)',
    exemplo: '"JavaScript".substring(0, 4); // "Java"',
    url: MDN + 'Global_Objects/String/substring',
  },
  'padStart': {
    resumo: 'Completa o texto no início até ter um tamanho (ótimo para zeros à esquerda).',
    sintaxe: 'texto.padStart(tamanho, preenchimento)',
    exemplo: 'String(5).padStart(2, "0"); // "05"',
    url: MDN + 'Global_Objects/String/padStart',
  },

  // ---------------- objetos ----------------
  'Object.keys': {
    resumo: 'Devolve um array com os nomes das propriedades de um objeto.',
    sintaxe: 'Object.keys(obj)',
    exemplo: 'Object.keys({ a: 1, b: 2 }); // ["a", "b"]',
    url: MDN + 'Global_Objects/Object/keys',
  },
  'Object.values': {
    resumo: 'Devolve um array com os valores de um objeto.',
    sintaxe: 'Object.values(obj)',
    exemplo: 'Object.values({ a: 1, b: 2 }); // [1, 2]',
    url: MDN + 'Global_Objects/Object/values',
  },
  'Object.entries': {
    resumo: 'Devolve um array de pares [chave, valor] — permite usar map/forEach/for...of em objetos.',
    sintaxe: 'Object.entries(obj)',
    exemplo: 'for (const [chave, valor] of Object.entries(obj)) {\n  console.log(chave, valor);\n}',
    url: MDN + 'Global_Objects/Object/entries',
  },

  // ---------------- DOM (navegador) ----------------
  'document': {
    resumo: 'Representa a página HTML. Use para buscar e alterar elementos.',
    sintaxe: 'document.querySelector("seletor")',
    exemplo: 'const titulo = document.querySelector("h1");',
    url: MDN_API + 'Document',
  },
  'getElementById': {
    resumo: 'Busca um elemento pelo id. Atenção: "Id" com I maiúsculo e d minúsculo.',
    sintaxe: 'document.getElementById("id")',
    exemplo: 'const botao = document.getElementById("enviar");',
    url: MDN_API + 'Document/getElementById',
  },
  'querySelector': {
    resumo: 'Busca o primeiro elemento que combina com um seletor CSS.',
    sintaxe: 'document.querySelector("#id .classe")',
    exemplo: 'const campo = document.querySelector("#nome");',
    url: MDN_API + 'Document/querySelector',
  },
  'querySelectorAll': {
    resumo: 'Busca todos os elementos que combinam com um seletor CSS (devolve uma NodeList).',
    sintaxe: 'document.querySelectorAll(".classe")',
    exemplo: 'document.querySelectorAll("li").forEach((li) => li.remove());',
    url: MDN_API + 'Document/querySelectorAll',
  },
  'addEventListener': {
    resumo: 'Executa uma função quando um evento acontece (click, input, submit...). Note o "L" maiúsculo.',
    sintaxe: 'elemento.addEventListener("evento", funcao)',
    exemplo: 'botao.addEventListener("click", () => {\n  console.log("clicou");\n});',
    url: MDN_API + 'EventTarget/addEventListener',
  },
  'innerHTML': {
    resumo: 'Lê ou troca o HTML de dentro de um elemento. Para só texto, prefira textContent.',
    sintaxe: 'elemento.innerHTML = "<b>oi</b>";',
    exemplo: 'lista.innerHTML = "";',
    url: MDN_API + 'Element/innerHTML',
  },
  'textContent': {
    resumo: 'Lê ou troca o texto de um elemento.',
    sintaxe: 'elemento.textContent = "texto";',
    exemplo: 'titulo.textContent = "Olá!";',
    url: MDN_API + 'Node/textContent',
  },
  'localStorage': {
    resumo: 'Guarda textos no navegador (setItem/getItem). Para objetos use JSON.stringify/JSON.parse.',
    sintaxe: 'localStorage.setItem("chave", "valor")',
    exemplo: 'localStorage.setItem("tema", "escuro");\nconst tema = localStorage.getItem("tema");',
    url: MDN_API + 'Window/localStorage',
  },
};

// Palavras reservadas (MDN, Lexical grammar > Keywords).
const reservadas = [
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else',
  'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
  'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while',
  'with', 'let', 'static', 'yield', 'await', 'enum', 'implements', 'interface', 'package', 'private',
  'protected', 'public',
];

// Palavras-chave que os iniciantes costumam escrever errado (alvo da detecção de erro de digitação).
const palavrasChave = [
  'function', 'async', 'await', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch',
  'case', 'default', 'break', 'continue', 'class', 'extends', 'new', 'typeof', 'instanceof', 'try', 'catch',
  'finally', 'throw', 'import', 'export', 'delete', 'static', 'constructor', 'this', 'true', 'false', 'null',
  'undefined',
];

// Objetos globais (MDN, Standard built-in objects + APIs mais usadas do navegador/Node).
const globais = [
  'globalThis', 'Infinity', 'NaN', 'undefined', 'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt',
  'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'Object', 'Function', 'Boolean',
  'Symbol', 'Error', 'AggregateError', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError',
  'URIError', 'Number', 'BigInt', 'Math', 'Date', 'String', 'RegExp', 'Array', 'Map', 'Set', 'WeakMap',
  'WeakSet', 'ArrayBuffer', 'DataView', 'JSON', 'Promise', 'Reflect', 'Proxy', 'Intl',
  'console', 'document', 'window', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'alert', 'prompt', 'confirm', 'localStorage', 'sessionStorage', 'navigator', 'location', 'require',
  'module', 'process',
];

// Métodos/propriedades mais comuns por tipo (para sugerir quando o nome foi digitado errado).
const metodosPorTipo = {
  Console: ['log', 'error', 'warn', 'info', 'debug', 'table', 'clear', 'group', 'groupEnd', 'time', 'timeEnd', 'dir', 'assert', 'count', 'trace'],
  Promise: ['then', 'catch', 'finally'],
  Array: ['length', 'push', 'pop', 'shift', 'unshift', 'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'findLast', 'includes', 'indexOf', 'lastIndexOf', 'slice', 'splice', 'join', 'sort', 'reverse', 'some', 'every', 'concat', 'flat', 'flatMap', 'fill', 'at', 'keys', 'values', 'entries', 'toSorted', 'toReversed'],
  String: ['length', 'split', 'trim', 'trimStart', 'trimEnd', 'toUpperCase', 'toLowerCase', 'replace', 'replaceAll', 'includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'slice', 'substring', 'padStart', 'padEnd', 'charAt', 'charCodeAt', 'repeat', 'at', 'concat', 'match', 'matchAll', 'search', 'localeCompare', 'normalize'],
  Number: ['toFixed', 'toString', 'toPrecision', 'toLocaleString', 'valueOf'],
  NumberConstructor: ['isInteger', 'isNaN', 'isFinite', 'parseFloat', 'parseInt', 'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'EPSILON'],
  Math: ['round', 'floor', 'ceil', 'random', 'max', 'min', 'abs', 'pow', 'sqrt', 'trunc', 'sign', 'PI', 'log', 'sin', 'cos'],
  JSON: ['parse', 'stringify'],
  ObjectConstructor: ['keys', 'values', 'entries', 'assign', 'freeze', 'fromEntries', 'create', 'defineProperty'],
  Document: ['getElementById', 'getElementsByClassName', 'getElementsByTagName', 'querySelector', 'querySelectorAll', 'createElement', 'addEventListener', 'removeEventListener', 'body', 'head', 'title', 'documentElement', 'createTextNode'],
  Element: ['addEventListener', 'removeEventListener', 'innerHTML', 'textContent', 'innerText', 'classList', 'setAttribute', 'getAttribute', 'removeAttribute', 'appendChild', 'append', 'remove', 'querySelector', 'querySelectorAll', 'style', 'value', 'id', 'className', 'parentElement', 'children', 'focus', 'click'],
  Response: ['json', 'text', 'blob', 'ok', 'status', 'statusText', 'headers'],
  Storage: ['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length'],
  Date: ['getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes', 'getSeconds', 'getTime', 'toISOString', 'toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'],
};

/** Descobre a lista de métodos a partir do nome do tipo que aparece na mensagem do TypeScript. */
function metodosDoTipo(tipo) {
  const t = tipo.trim();
  if (/\[\]$/.test(t) || /^(Array|ReadonlyArray)</.test(t) || /^NodeListOf</.test(t)) return { nome: 'Array', lista: metodosPorTipo.Array };
  if (/^Promise</.test(t)) return { nome: 'Promise', lista: metodosPorTipo.Promise };
  if (t === 'string' || /^["'`]/.test(t) || t === 'String') return { nome: 'String', lista: metodosPorTipo.String };
  if (t === 'number' || /^-?\d/.test(t)) return { nome: 'Number', lista: metodosPorTipo.Number };
  if (t === 'NumberConstructor') return { nome: 'Number', lista: metodosPorTipo.NumberConstructor };
  if (t === 'ObjectConstructor') return { nome: 'Object', lista: metodosPorTipo.ObjectConstructor };
  if (/^HTML\w*Element$|^Element$/.test(t)) return { nome: 'Element', lista: metodosPorTipo.Element };
  if (metodosPorTipo[t]) return { nome: t, lista: metodosPorTipo[t] };
  return null;
}

/** Busca uma entrada da referência (aceita "console.log", "Array.prototype.map", "map()" etc.). */
function buscarReferencia(nome) {
  if (!nome) return null;
  const limpo = nome.replace(/\(\)$/, '').replace(/\.prototype\./, '.');
  if (referencia[limpo]) return { nome: limpo, ...referencia[limpo] };
  const ultimo = limpo.split('.').pop();
  if (referencia[ultimo]) return { nome: ultimo, ...referencia[ultimo] };
  return null;
}

module.exports = { referencia, reservadas, palavrasChave, globais, metodosPorTipo, metodosDoTipo, buscarReferencia };
