// Teste com projetos de várias camadas (server / routes / controllers / models / services):
//   node teste-projetos.js
// Monta um mini projeto numa pasta temporária e usa saídas REAIS do Node 24 (Express 5, CommonJS e ESM),
// só trocando o caminho da pasta. Confere: arquivo/linha escolhidos, tradução e causa.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { interpretarErro, colunaNoArquivo } = require('./erro-colado');
const { analisar } = require('./analisador');
const { analisarModulo } = require('./modulos');
const { traduzirLocal } = require('./tradutor');

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tradutor-projetos-'));
const P = (...p) => path.join(raiz, ...p);
const arquivos = {
  'cjs/node_modules/express/package.json': '{}',
  'cjs/node_modules/router/lib/route.js': '// lib\n',
  'cjs/models/Usuario.js': 'class Usuario {}\nmodule.exports = Usuario;\n',
  'cjs/services/bancoFake.js': 'function achar(id) { return null; }\nmodule.exports = { achar };\n',
  'cjs/routes/usuarios.js': "const express = require('express');\nconst listar = require('../controllers/usuarioController');\n\nconst router = express.Router();\n\nrouter.get('/', listar);\n\nmodule.exports = router;\n",
  'cjs/server.js': "const express = require('expresss');\n",
  'cjs/controllers/semChave.js': "const Usuario = require('../models/Usuario');\n\nclass UsuarioController {\n  criar(req, res) {\n    const { nome } = req.body;\n    res.status(201).json({ nome });\n}\n\nmodule.exports = new UsuarioController();\n",
  'cjs/controllers/usuarioController.js': [
    "const Usuario = require('../models/usuarioModel');",                  // 1
    "const Fake = require('../services/bancoFake');",                      // 2
    '',                                                                   // 3
    'class UsuarioController {',                                          // 4
    '  formatar(u) { return u; }',                                        // 5
    '  listar(req, res) {',                                               // 6
    '    res.json([1].map((u) => this.formatar(u)));',                    // 7
    '  }',                                                                // 8
    '  mostrar(req, res) {',                                              // 9
    '    const usuario = Usuario.buscar(req.params.id);',                 // 10
    '    res.json({ nome: usuario.nome.toUpperCase() });',                // 11
    '  }',                                                                // 12
    '  criar(req, res) {',                                                // 13
    '    const { nome, email } = req.body;',                              // 14
    '    if (!nome) {',                                                   // 15
    "      res.status(400).json({ erro: 'nome obrigatório' });",          // 16
    '    }',                                                              // 17
    '    res.json({ nome, email });',                                     // 18
    '  }',                                                                // 19
    '  novo(req, res) {',                                                 // 20
    '    const u = new Fake();',                                          // 21
    '  }',                                                                // 22
    '}',                                                                  // 23
    'module.exports = new UsuarioController();',                          // 24
    '',
  ].join('\n'),
  'esm/models/Usuario.js': 'export default class Usuario {}\n',
  'esm/services/bancoFake.js': 'export function listarTodos() { return []; }\nexport function achar(id) { return null; }\n',
  'esm/node_modules/express/package.json': '{}',
  'esm/controllers/usuarioController.js': "import Usuario from '../models/Usuarioo.js';\nimport { Usuario as U2 } from '../models/Usuario.js';\nimport Usuario3 from '../models/Usuario';\n",
  'esm/models/Pedido.js': "import banco from '../services/bancoFake.js';\nimport express from 'expresss';\n",
};
for (const [rel, conteudo] of Object.entries(arquivos)) {
  fs.mkdirSync(path.dirname(P(rel)), { recursive: true });
  fs.writeFileSync(P(rel), conteudo);
}
const uc = P('cjs', 'controllers', 'usuarioController.js');

const casos = [
  {
    titulo: 'Erro lançado de dentro do node_modules (Express): abre a rota, não a biblioteca',
    saida: `${P('cjs', 'node_modules', 'router', 'lib', 'route.js')}:234\n        throw new TypeError('argument handler must be a function')\n        ^\n\nTypeError: argument handler must be a function\n    at Route.<computed> [as get] (${P('cjs', 'node_modules', 'router', 'lib', 'route.js')}:234:15)\n    at Router.<computed> [as get] (${P('cjs', 'node_modules', 'router', 'index.js')}:504:19)\n    at Object.<anonymous> (${P('cjs', 'routes', 'usuarios.js')}:6:8)\n    at Module._compile (node:internal/modules/cjs/loader:1761:14)`,
    local: [P('cjs', 'routes', 'usuarios.js'), 6],
    causa: '`listar`, passado para `router.get()`, não é uma função', traducao: 'A função passada para a rota',
  },
  {
    titulo: 'require com caminho errado (Require stack)',
    saida: `node:internal/modules/cjs/loader:1424\n  throw err;\n  ^\n\nError: Cannot find module '../models/usuarioModel'\nRequire stack:\n- ${uc}\n- ${P('cjs', 'server.js')}\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1421:15)\n    at Object.<anonymous> (${uc}:1:17)\n    at Module._compile (node:internal/modules/cjs/loader:1761:14)`,
    local: [uc, 1], modulo: 'O arquivo `usuarioModel` não existe', localCausa: [1, 26], traducao: 'Não foi possível encontrar o módulo',
  },
  {
    titulo: 'require de pacote com nome errado (sugere o instalado)',
    saida: `node:internal/modules/cjs/loader:1424\n  throw err;\n  ^\n\nError: Cannot find module 'expresss'\nRequire stack:\n- ${P('cjs', 'server.js')}\n    at Module._resolveFilename (node:internal/modules/cjs/loader:1421:15)\n    at Object.<anonymous> (${P('cjs', 'server.js')}:1:17)`,
    local: [P('cjs', 'server.js'), 1], modulo: 'provavelmente é `express`',
  },
  {
    titulo: 'ESM: import de arquivo inexistente (só "imported from")',
    saida: `node:internal/modules/esm/resolve:274\n    throw new ERR_MODULE_NOT_FOUND(\n          ^\n\nError [ERR_MODULE_NOT_FOUND]: Cannot find module '${P('esm', 'models', 'Usuarioo.js')}' imported from ${P('esm', 'controllers', 'usuarioController.js')}\n    at finalizeResolution (node:internal/modules/esm/resolve:274:11) {\n  code: 'ERR_MODULE_NOT_FOUND'\n}`,
    local: [P('esm', 'controllers', 'usuarioController.js'), null], modulo: 'existe `Usuario.js`', localCausa: [1, 22], traducao: "O arquivo 'models/Usuarioo.js' não existe",
  },
  {
    titulo: 'ESM: import sem a extensão .js',
    saida: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '${P('esm', 'models', 'Usuario')}' imported from ${P('esm', 'controllers', 'usuarioController.js')}\n    at finalizeResolution (node:internal/modules/esm/resolve:274:11)`,
    local: [P('esm', 'controllers', 'usuarioController.js'), null], modulo: 'falta `.js`', localCausa: [3, 23],
  },
  {
    titulo: 'ESM: pacote não instalado',
    saida: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'expresss' imported from ${P('esm', 'models', 'Pedido.js')}\n    at packageResolve (node:internal/modules/esm/resolve:767:9)`,
    local: [P('esm', 'models', 'Pedido.js'), null], modulo: 'provavelmente é `express`', localCausa: [2, 22], traducao: "O pacote 'expresss' não está instalado",
  },
  {
    titulo: 'ESM: nome que não é exportado (arquivo só tem export default)',
    saida: `file:///${P('esm', 'controllers', 'usuarioController.js').replace(/\\/g, '/')}:2\nimport { Usuario as U2 } from '../models/Usuario.js';\n         ^^^^^^^\nSyntaxError: The requested module '../models/Usuario.js' does not provide an export named 'Usuario'\n    at #asyncInstantiate (node:internal/modules/esm/module_job:302:21)`,
    local: [`file:///${P('esm', 'controllers', 'usuarioController.js').replace(/\\/g, '/')}`, 2], modulo: 'não exporta nada chamado `Usuario`', dica: 'só tem `export default`', traducao: "não exporta nada chamado 'Usuario'",
  },
  {
    titulo: 'ESM: import default de arquivo sem export default',
    saida: `file:///${P('esm', 'models', 'Pedido.js').replace(/\\/g, '/')}:1\nimport banco from '../services/bancoFake.js';\n       ^^^^^\nSyntaxError: The requested module '../services/bancoFake.js' does not provide an export named 'default'\n    at #asyncInstantiate (node:internal/modules/esm/module_job:302:21)`,
    local: [`file:///${P('esm', 'models', 'Pedido.js').replace(/\\/g, '/')}`, 1], modulo: 'não tem `export default`', traducao: "não tem 'export default'",
  },
  {
    titulo: 'this perdido (método passado como callback)',
    saida: `TypeError: Cannot read properties of undefined (reading 'formatar')\n    at ${uc}:7:36\n    at Array.map (<anonymous>)\n    at listar (${uc}:7:20)\n    at Layer.handleRequest (${P('cjs', 'node_modules', 'router', 'lib', 'layer.js')}:169:33)`,
    local: [uc, 7], causa: '`this` está `undefined` aqui', chamadas: 2,
  },
  {
    titulo: 'await esquecido (Promise no lugar do valor)',
    saida: `TypeError: Cannot read properties of undefined (reading 'toUpperCase')\n    at mostrar (${uc}:11:35)\n    at Layer.handleRequest (${P('cjs', 'node_modules', 'router', 'lib', 'layer.js')}:169:33)`,
    local: [uc, 11], causa: 'foi chamada sem `await`', localCausa: [10, 21],
  },
  {
    titulo: 'req.body undefined (faltou express.json())',
    saida: `TypeError: Cannot destructure property 'nome' of 'req.body' as it is undefined.\n    at criar (${uc}:14:13)\n    at Layer.handleRequest (${P('cjs', 'node_modules', 'router', 'lib', 'layer.js')}:169:33)`,
    local: [uc, 14], causa: '`req.body` está `undefined`', traducao: 'app.use(express.json())',
  },
  {
    titulo: 'Resposta enviada duas vezes (falta return)',
    saida: `Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client\n    at ServerResponse.setHeader (node:_http_outgoing:642:11)\n    at ServerResponse.json (${P('cjs', 'node_modules', 'express', 'lib', 'response.js')}:249:15)\n    at criar (${uc}:18:9)`,
    local: [uc, 18], causa: 'A resposta já foi enviada na linha 16', localCausa: [16, 7], traducao: 'coloque \'return\'',
  },
  {
    titulo: 'Sem module.exports: "is not a constructor"',
    saida: `TypeError: Fake is not a constructor\n    at novo (${uc}:21:15)`,
    local: [uc, 21], causa: '`Fake` não é uma classe',
  },
  {
    titulo: 'Chave } faltando: Node reclama do module.exports lá embaixo',
    saida: `${P('cjs', 'controllers', 'semChave.js')}:9\nmodule.exports = new UsuarioController();\n      ^\n\nSyntaxError: Unexpected token '.'\n    at wrapSafe (node:internal/modules/cjs/loader:1692:18)`,
    local: [P('cjs', 'controllers', 'semChave.js'), 9], causa: 'A chave `{` aberta na linha 4', localCausa: [4, 19],
  },
  {
    titulo: 'Promise rejeitada com texto (UnhandledPromiseRejection)',
    saida: 'node:internal/process/promises:392\n      new UnhandledPromiseRejection(reason);\n      ^\n\nUnhandledPromiseRejection: This error originated either by throwing inside of an async function without a catch block, or by rejecting a promise which was not handled with .catch(). The promise rejected with the reason "conexão recusada".\n    at throwUnhandledRejectionsMode (node:internal/process/promises:392:7) {\n  code: \'ERR_UNHANDLED_REJECTION\'\n}',
    local: null, principal: /^UnhandledPromiseRejection: /, traducao: 'Uma Promise foi rejeitada e ninguém tratou',
  },
  {
    titulo: 'Porta ocupada (EADDRINUSE)',
    saida: "node:events:486\n      throw er; // Unhandled 'error' event\n      ^\n\nError: listen EADDRINUSE: address already in use :::3000\n    at Server.setupListenHandle [as _listen2] (node:net:1940:16)",
    local: null, traducao: 'A porta já está em uso',
  },
  {
    titulo: 'Console do navegador com o link à direita (simulado)',
    saida: 'Uncaught ReferenceError: mostrarTudo is not defined    app.js:16',
    local: ['app.js', 16], principal: /^Uncaught ReferenceError: mostrarTudo is not defined$/, traducao: "'mostrarTudo' não está definido",
  },
  {
    titulo: 'CORS no console do navegador (simulado)',
    saida: "Access to fetch at 'http://localhost:3000/usuarios' from origin 'http://127.0.0.1:5500' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.\nGET http://localhost:3000/usuarios net::ERR_FAILED 200 (OK)\nUncaught (in promise) TypeError: Failed to fetch\n    at carregar (http://127.0.0.1:5500/app.js:7:26)",
    local: ['http://127.0.0.1:5500/app.js', 7], principal: /^Access to fetch/, traducao: 'Bloqueado por CORS',
  },
];

let falhas = 0;
for (const c of casos) {
  const info = interpretarErro(c.saida);
  const erros = [];
  if (c.principal && !c.principal.test(info.principal)) erros.push(`principal: ${info.principal}`);
  if (c.local === null) {
    if (info.local) erros.push(`não deveria ter local, veio ${info.local.caminho}:${info.local.linha}`);
  } else if (!info.local) {
    erros.push('local não encontrado');
  } else if (info.local.caminho !== c.local[0] || info.local.linha !== c.local[1]) {
    erros.push(`local ${info.local.caminho}:${info.local.linha} (esperado ${c.local.join(':')})`);
  }
  if (c.chamadas !== undefined && info.chamadas.length !== c.chamadas) erros.push(`chamadas ${info.chamadas.length}`);
  if (c.traducao) {
    const t = traduzirLocal(info.principal);
    if (!t || !t.includes(c.traducao)) erros.push(`tradução: ${t}`);
  }
  if (c.causa || c.modulo) {
    const arq = info.local.caminho.startsWith('file:') ? require('url').fileURLToPath(info.local.caminho) : info.local.caminho;
    const texto = fs.readFileSync(arq, 'utf8');
    const linha = info.local.linha !== null ? info.local.linha - 1 : null;
    const col = linha !== null ? (colunaNoArquivo(info.local, texto.split(/\r?\n/)[linha]) ?? 1) - 1 : 0;
    const r = c.modulo
      ? analisarModulo(info, arq, texto, linha)
      : analisar(texto, { linha, coluna: col, mensagem: info.principal });
    const esperado = c.modulo ?? c.causa;
    if (!r || !r.causa.includes(esperado)) erros.push(`causa: ${r ? r.causa : 'nenhuma'}`);
    else if (c.dica && !(r.dica ?? '').includes(c.dica)) erros.push(`dica: ${r.dica}`);
    else if (c.localCausa && (!r.local || r.local.linha !== c.localCausa[0] - 1 || r.local.col !== c.localCausa[1] - 1)) {
      erros.push(`local da causa ${r.local ? `${r.local.linha + 1}:${r.local.col + 1}` : '-'} (esperado ${c.localCausa.join(':')})`);
    }
  }
  if (erros.length) { falhas++; console.log(`✘ ${c.titulo}\n    ${erros.join('\n    ')}`); } else console.log(`✔ ${c.titulo}`);
}
fs.rmSync(raiz, { recursive: true, force: true });
console.log(`\n${casos.length - falhas}/${casos.length} casos corretos.`);
process.exitCode = falhas ? 1 : 0;
