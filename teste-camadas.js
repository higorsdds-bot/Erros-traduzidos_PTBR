// Teste da identificação de camadas pelo nome do arquivo/pasta:
//   node teste-camadas.js
// Sai com código 1 se algum caso falhar.
const { identificarCamada, dicaDaCamada, resumirCaminho } = require('./camadas');

// [caminho, camada esperada (id) ou null]
const casos = [
  // Model: pasta, prefixo, sufixo, plural, ponto, maiúsculas
  ['models/Usuario.js', 'model'],
  ['src/model/usuario.js', 'model'],
  ['Modelusuario.js', 'model'],
  ['modelsUsuarios.js', 'model'],
  ['ModelUsuario.js', 'model'],
  ['usuarioModel.js', 'model'],
  ['usuario.model.js', 'model'],
  ['user_model.py', 'model'],
  ['modelos/Produto.java', 'model'],
  ['entities/Pedido.ts', 'model'],
  ['schemas/usuarioSchema.js', 'model'],
  // Controller
  ['controllers/usuarioController.js', 'controller'],
  ['controllerUsuario.js', 'controller'],
  ['UsuarioController.java', 'controller'],
  ['src/controladores/produto.js', 'controller'],
  ['apiUsuarioControllerV2.js', 'controller'],
  ['authController.js', 'controller'],
  ['rotaController.js', 'controller'],
  // Rota
  ['routes/usuarios.js', 'rota'],
  ['routes/index.js', 'rota'],
  ['usuarioRoutes.js', 'rota'],
  ['rotasUsuario.js', 'rota'],
  ['rotas/produtos.js', 'rota'],
  ['user.routes.ts', 'rota'],
  ['router.js', 'rota'],
  // Banco
  ['db.js', 'banco'],
  ['config/db.js', 'banco'],
  ['database/conexao.js', 'banco'],
  ['conexao.js', 'banco'],
  ['dbConnection.js', 'banco'],
  ['usuarioDB.js', 'banco'],
  ['database.config.js', 'banco'],
  ['migrations/20240101-criar-usuarios.js', 'banco'],
  ['bancoDeDados.js', 'banco'],
  // Outras camadas
  ['services/usuarioService.js', 'service'],
  ['servicoEmail.js', 'service'],
  ['serviços/pagamento.js', 'service'],
  ['repositories/UsuarioRepository.ts', 'repositorio'],
  ['usuarioDAO.java', 'repositorio'],
  ['middlewares/verificarToken.js', 'middleware'],
  ['authMiddleware.js', 'middleware'],
  ['validators/usuario.js', 'validacao'],
  ['views/home.ejs', 'view'],
  ['public/js/script.js', 'view'],
  ['config/index.js', 'config'],
  ['utils/formatarData.js', 'util'],
  ['helpers.js', 'util'],
  ['__tests__/usuario.test.js', 'teste'],
  ['server.js', 'servidor'],
  ['src/app.js', 'servidor'],
  // Não deve confundir
  ['feedback.js', null],
  ['modelagem.js', null],
  ['rotacao.js', null],
  ['dbz.js', null],
  ['paginacao.js', null],
  ['calculadora.js', null],
  ['node_modules/express/lib/router/index.js', null],
];

let falhas = 0;
for (const [caminho, esperado] of casos) {
  const c = identificarCamada(caminho);
  const obtido = c ? c.id : null;
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? '✅' : '❌'} ${caminho.padEnd(42)} -> ${obtido ?? '(nenhuma)'}${ok ? '' : `  (esperado: ${esperado ?? 'nenhuma'})`}${c ? `  [${c.motivo}]` : ''}`);
}

// Dicas por camada
const dicas = [
  ['controllers/usuarioController.js', 'Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client', /return/],
  ['models/Usuario.js', 'TypeError: Usuario.findAll is not a function', /Sequelize/],
  ['routes/usuarios.js', 'TypeError: Router.use() requires a middleware function but got a Object', /controller/],
  ['models/Usuario.js', 'Error: connect ECONNREFUSED 127.0.0.1:3306', /não está rodando/],
  ['controllers/x.js', "Error: ER_NO_SUCH_TABLE: Table 'loja.usuarios' doesn't exist", /tabela não existe/],
  ['calculadora.js', 'TypeError: x is not a function', null],
];
for (const [caminho, msg, esperado] of dicas) {
  const d = dicaDaCamada(identificarCamada(caminho), msg);
  const ok = esperado === null ? d === null : !!d && esperado.test(d);
  if (!ok) falhas++;
  console.log(`${ok ? '✅' : '❌'} dica ${caminho} | ${msg.slice(0, 50)} -> ${d ? d.slice(0, 70) + '...' : '(nenhuma)'}`);
}

// Caminho das chamadas (a pilha vem de dentro para fora)
const caminho = resumirCaminho(['models/Usuario.js', 'controllers/usuarioController.js', 'controllers/usuarioController.js', 'routes/usuarios.js']
  .map((c) => ({ camada: identificarCamada(c) })));
const esperadoCaminho = '🛣️ Rota → 🎮 Controller → 🗃️ Model';
if (caminho !== esperadoCaminho) falhas++;
console.log(`${caminho === esperadoCaminho ? '✅' : '❌'} caminho: ${caminho}`);

const total = casos.length + dicas.length + 1;
console.log(`\n${total - falhas}/${total} casos de camadas corretos.`);
process.exit(falhas ? 1 : 0);
