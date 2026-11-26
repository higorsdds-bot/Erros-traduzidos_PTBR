// Identifica a camada do projeto (rota, controller, model, banco...) pelo NOME do arquivo e das pastas.
// Ex.: models/Usuario.js, Modelusuario.js, modelsUsuarios.js, usuario.model.js, UsuarioModel.js -> Model.
// Também dá dicas do que costuma dar errado em cada camada.
// Não depende do VS Code.

const path = require('path');

/**
 * Camadas, em ordem de prioridade (quando duas palavras aparecem no mesmo nome, vence a que termina
 * mais perto do fim do nome: "rotaController" -> Controller).
 * chaves: palavras procuradas (sem acento, minúsculas). O plural com "s" já é aceito automaticamente.
 */
const CAMADAS = [
  {
    id: 'rota',
    nome: 'Rota',
    emoji: '🛣️',
    chaves: ['routes', 'route', 'router', 'rotas', 'rota', 'roteador', 'endpoint', 'urls'],
    papel: 'recebe a requisição (o endereço + GET/POST/PUT/DELETE) e chama a função certa do controller.',
    dicas: [
      [/requires a callback function|argument handler must be a function|requires a middleware function|handler must be a function/i,
        'Numa rota, isso quase sempre é o **controller importado errado**: confira o `module.exports`/`export` do controller e o nome do método usado aqui (ex.: `usuarioController.listar` existe?).'],
      [/Cannot (?:GET|POST|PUT|PATCH|DELETE) /i,
        'A rota não está registrada: confira o caminho (`/usuarios` x `/usuario`), o método (GET/POST...) e se o server faz `app.use(\'/prefixo\', rotas)`.'],
      [/is not a function/i,
        'Na rota, confira se o arquivo de rotas exporta o `router` (`module.exports = router`) e se o método do controller existe.'],
    ],
  },
  {
    id: 'controller',
    nome: 'Controller',
    emoji: '🎮',
    chaves: ['controllers', 'controller', 'controlador', 'controladores', 'ctrl', 'handler', 'handlers'],
    papel: 'lê os dados da requisição (`req.params`, `req.query`, `req.body`), chama o service/model e devolve a resposta (`res.json`, `res.status`).',
    dicas: [
      [/Cannot set headers after they are sent|ERR_HTTP_HEADERS_SENT/i,
        'No controller, a resposta foi enviada duas vezes: falta um `return` depois de `res.json(...)`/`res.send(...)` dentro de um `if`.'],
      [/req\.body/i,
        'No controller, `req.body` só tem dados se o server usar `app.use(express.json())` ANTES das rotas, e se o cliente enviar JSON.'],
      [/Cannot (?:read|set) properties of (?:undefined|null)/i,
        'No controller, confira de onde veio o valor que está vazio: do model/service (talvez o registro não foi encontrado — trate com `if (!x) return res.status(404)...`) ou da requisição (`req.params`, `req.query`, `req.body`).'],
      [/is not a function/i,
        'No controller, confira se o método chamado existe no model/service e se ele foi exportado e importado do jeito certo (com ou sem chaves).'],
      [/is not defined/i,
        'No controller, provavelmente faltou importar o model/service no topo do arquivo (`require`/`import`).'],
    ],
  },
  {
    id: 'service',
    nome: 'Service',
    emoji: '⚙️',
    chaves: ['services', 'service', 'servico', 'servicos', 'usecase', 'usecases', 'business'],
    papel: 'guarda a regra de negócio (validações, cálculos) entre o controller e o model.',
    dicas: [
      [/is not a function/i, 'No service, confira se o model/repositório usado foi importado certo e se o método existe nele.'],
      [/Cannot read properties of (?:undefined|null)/i, 'No service, o valor que veio do model/banco pode estar vazio (nenhum registro encontrado). Verifique antes de usar: `if (!usuario) ...`.'],
    ],
  },
  {
    id: 'repositorio',
    nome: 'Repository',
    emoji: '📦',
    chaves: ['repositories', 'repository', 'repositorio', 'repositorios', 'dao', 'daos'],
    papel: 'faz as consultas ao banco (SELECT, INSERT, UPDATE...) para o service/model.',
    dicas: [],
  },
  {
    id: 'model',
    nome: 'Model',
    emoji: '🗃️',
    chaves: ['models', 'model', 'modelo', 'modelos', 'entity', 'entities', 'entidade', 'entidades', 'schema', 'schemas'],
    papel: 'representa os dados (ex.: `Usuario`, `Produto`) e faz as consultas no banco.',
    dicas: [
      [/is not a function/i,
        'No model, métodos como `findAll`, `findOne`, `create`, `find` vêm da biblioteca (Sequelize, Mongoose, Prisma...). Confira se o model foi exportado (`module.exports = Usuario`) e se o nome do método é dessa biblioteca.'],
      [/Cannot read properties of (?:undefined|null)/i,
        'No model, normalmente a consulta não encontrou nada (voltou `null`/`undefined`) ou a conexão com o banco (`db`, `pool`, `sequelize`) não foi importada.'],
      [/is not defined/i,
        'No model, provavelmente faltou importar a conexão com o banco (ex.: `const db = require(\'../config/db\')`).'],
    ],
  },
  {
    id: 'banco',
    nome: 'Banco de dados',
    emoji: '🛢️',
    chaves: ['database', 'databases', 'db', 'dbs', 'banco', 'bancos', 'bancodedados', 'conexao', 'conexoes', 'connection', 'connections',
      'migration', 'migrations', 'migracao', 'migracoes', 'seed', 'seeds', 'seeder', 'seeders', 'prisma', 'knexfile', 'sql'],
    papel: 'abre a conexão com o banco (MySQL, PostgreSQL, MongoDB, SQLite...) e define as tabelas.',
    dicas: [],
  },
  {
    id: 'middleware',
    nome: 'Middleware',
    emoji: '🚧',
    chaves: ['middlewares', 'middleware', 'interceptor', 'interceptors', 'guard', 'guards', 'auth'],
    papel: 'roda ANTES do controller (ex.: verificar login/token, validar dados) e chama `next()` para seguir.',
    dicas: [
      [/next is not a function/i, 'O middleware precisa receber `(req, res, next)` e ser usado SEM parênteses: `app.use(verificarToken)`, não `app.use(verificarToken())`.'],
      [/jwt|token|invalid signature|jsonwebtoken/i, 'Erro no token: confira se o cliente envia `Authorization: Bearer <token>` e se a chave secreta (`JWT_SECRET`) é a mesma usada para gerar o token.'],
    ],
  },
  {
    id: 'validacao',
    nome: 'Validação',
    emoji: '✔️',
    chaves: ['validators', 'validator', 'validation', 'validations', 'validacao', 'validacoes', 'validador', 'validadores', 'dto', 'dtos'],
    papel: 'confere se os dados recebidos estão certos antes de salvar (campos obrigatórios, formato de e-mail...).',
    dicas: [],
  },
  {
    id: 'view',
    nome: 'View (tela)',
    emoji: '🖥️',
    chaves: ['views', 'view', 'pages', 'page', 'pagina', 'paginas', 'tela', 'telas', 'template', 'templates',
      'component', 'components', 'componente', 'componentes', 'public', 'static', 'frontend', 'front'],
    papel: 'é a parte que o usuário vê (HTML, componentes, scripts do navegador).',
    dicas: [
      [/(?:document|window|localStorage) is not defined/i, 'Este código é de navegador (`document`/`window`) mas está rodando no Node (servidor). Ele precisa ser carregado pelo HTML com `<script>`, não por `node arquivo.js`.'],
      [/Cannot (?:read|set) properties of null/i, 'Na tela, quase sempre o `getElementById`/`querySelector` não achou o elemento: o id/classe está diferente do HTML, ou o `<script>` está antes do elemento (use `defer`).'],
    ],
  },
  {
    id: 'config',
    nome: 'Configuração',
    emoji: '🔧',
    chaves: ['config', 'configs', 'configuration', 'configuracao', 'configuracoes', 'settings', 'env'],
    papel: 'guarda as configurações do projeto (porta, dados do banco, chaves, variáveis do `.env`).',
    dicas: [
      [/undefined/i, 'Em configuração, valores `undefined` geralmente são variáveis do `.env` que não foram carregadas: confira o `require(\'dotenv\').config()` no início do server e o nome da variável.'],
    ],
  },
  {
    id: 'util',
    nome: 'Utilitário',
    emoji: '🧰',
    chaves: ['utils', 'util', 'helper', 'helpers', 'utilitario', 'utilitarios', 'lib', 'libs', 'shared', 'common'],
    papel: 'funções de apoio usadas em várias partes do projeto (formatar data, gerar senha...).',
    dicas: [],
  },
  {
    id: 'teste',
    nome: 'Teste',
    emoji: '🧪',
    chaves: ['test', 'tests', '__tests__', 'spec', 'specs', 'teste', 'testes'],
    papel: 'testes automatizados do projeto.',
    dicas: [],
  },
];

// Arquivo de entrada do servidor: só pelo nome exato do arquivo, e só se nenhuma outra camada foi achada.
const SERVIDOR = {
  id: 'servidor',
  nome: 'Servidor (entrada)',
  emoji: '🚀',
  arquivos: ['server', 'servidor', 'app', 'index', 'main'],
  papel: 'é o arquivo que liga o servidor: cria o `app`, configura `express.json()`, registra as rotas e chama `app.listen`.',
  dicas: [
    [/EADDRINUSE/i, 'A porta já está em uso: outro servidor (talvez este mesmo, aberto em outro terminal) está rodando. Feche-o com `Ctrl+C` ou troque a porta.'],
    [/requires a middleware function/i, 'No server, `app.use(\'/x\', rotas)` precisa receber o `router`: confira se o arquivo de rotas tem `module.exports = router`.'],
  ],
};

// Palavras que começam com uma chave mas não são a camada (ex.: "modelagem" não é model).
const EXCECOES = new Set(['modelagem', 'modelagens', 'routine', 'routines', 'rotacao', 'rotacionar', 'rotatoria', 'servicedesk', 'testemunho', 'pagination', 'paginacao', 'viewport', 'publicar', 'publicacao', 'frontmatter', 'authors', 'author', 'autor']);

// Dicas de banco de dados: valem em qualquer camada (o erro de conexão aparece onde a consulta foi feita).
const DICAS_BANCO = [
  [/ECONNREFUSED/i, 'O servidor do banco de dados não está rodando (ou a porta está errada). Inicie o MySQL/PostgreSQL/MongoDB e confira host e porta no `.env`/config.'],
  [/ER_ACCESS_DENIED|password authentication failed|Authentication failed|Access denied for user/i, 'Usuário ou senha do banco errados: confira os dados de conexão no `.env`/config.'],
  [/ER_BAD_DB_ERROR|Unknown database|database "[^"]+" does not exist/i, 'O banco (database) com esse nome não existe: crie-o (ex.: `CREATE DATABASE nome;`) ou corrija o nome na config.'],
  [/ER_NO_SUCH_TABLE|relation "[^"]+" does not exist|no such table|Table '[^']+' doesn't exist/i, 'A tabela não existe no banco: rode as migrations ou crie a tabela. Confira também o nome (singular/plural, maiúsculas).'],
  [/ER_BAD_FIELD_ERROR|Unknown column|column "[^"]+" does not exist|no such column/i, 'A coluna não existe na tabela: confira o nome do campo no model/consulta e na tabela do banco.'],
  [/ER_DUP_ENTRY|duplicate key value|UNIQUE constraint failed|E11000/i, 'Registro duplicado: já existe um registro com esse valor num campo único (ex.: e-mail já cadastrado). Trate esse caso antes de inserir.'],
  [/ER_PARSE_ERROR|syntax error at or near|You have an error in your SQL syntax|SQLITE_ERROR: near/i, 'Erro na escrita da consulta SQL: confira vírgulas, aspas e nomes perto do trecho que a mensagem mostra.'],
  [/ENOTFOUND|getaddrinfo/i, 'O endereço (host) do banco/serviço não foi encontrado: confira o host na config/`.env` (ex.: `localhost`).'],
  [/MongooseServerSelectionError|MongoNetworkError|buffering timed out/i, 'O Mongoose não conseguiu conectar no MongoDB: confira se o MongoDB está rodando e a string de conexão (`MONGO_URI`). O `mongoose.connect` precisa ser chamado antes das consultas.'],
];

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const ehLetra = (c) => c !== undefined && /[a-zA-Z]/.test(c);
const ehMaiuscula = (c) => c !== undefined && /[A-Z]/.test(c);

/**
 * Procura uma chave num pedaço de nome (sem separadores). Retorna a posição do fim do casamento, ou -1.
 * Aceita: igual ("models"), no começo ("Modelusuario", "modelsUsuarios", "dbConexao") e no fim ("usuarioModel", "UserRoutes"),
 * e também como palavra do camelCase no meio ("apiUsuarioControllerV2").
 * Chaves curtas (até 4 letras, ex.: "db", "rota", "view") exigem fronteira clara (maiúscula, número ou fim).
 */
function casarChave(original, chave) {
  const s = original.toLowerCase();
  const curta = chave.length <= 4;
  for (const k of [chave + 's', chave]) {
    if (s === k) return s.length;
    // começo
    if (s.startsWith(k)) {
      const prox = original[k.length];
      if (!curta || !ehLetra(prox) || ehMaiuscula(prox)) return k.length;
    }
    // fim
    if (s.endsWith(k)) {
      const ini = s.length - k.length;
      const ant = original[ini - 1];
      if (!curta || !ehLetra(ant) || ehMaiuscula(original[ini])) return s.length;
    }
  }
  // palavra no meio do camelCase: ...Controller..., ...Model...
  const palavras = original.split(/(?<=[a-z0-9])(?=[A-Z])/);
  let pos = 0;
  for (const p of palavras) {
    pos += p.length;
    const pl = p.toLowerCase();
    if (pl === chave || pl === chave + 's') return pos;
  }
  return -1;
}

/** Acha a camada de um nome (de arquivo ou pasta). Retorna { camada, chave, fim } ou null. */
function camadaDoNome(nome) {
  const base = semAcento(nome);
  if (!base) return null;
  let melhor = null;
  let melhorSemConfig = null; // "database.config.js" é do banco, não uma configuração qualquer
  const melhorQue = (a, b) => !b || a.fim > b.fim || (a.fim === b.fim && a.chave.length > b.chave.length);
  // Separa por ponto, hífen, sublinhado e espaço: "usuario.model", "user-routes", "conexao_db".
  let deslocamento = 0;
  for (const parte of base.split(/[.\-_\s]+/)) {
    deslocamento += parte.length + 1;
    if (!parte || EXCECOES.has(parte.toLowerCase())) continue;
    for (const camada of CAMADAS) {
      for (const chave of camada.chaves) {
        const fim = casarChave(parte, chave);
        if (fim < 0) continue;
        const achado = { camada, chave, fim: deslocamento - parte.length - 1 + fim };
        if (melhorQue(achado, melhor)) melhor = achado;
        if (camada.id !== 'config' && melhorQue(achado, melhorSemConfig)) melhorSemConfig = achado;
      }
    }
  }
  return melhorSemConfig ?? melhor;
}

/**
 * Identifica a camada de um arquivo.
 * @param {string} caminho  de preferência relativo à pasta do projeto (para não olhar pastas de fora dele)
 * @returns {null | { id, nome, emoji, papel, dicas, motivo, palavra }}
 */
function identificarCamada(caminho) {
  if (!caminho) return null;
  const partes = String(caminho).replace(/^file:\/\/\/?/i, '').split(/[\\/]+/).filter(Boolean);
  if (!partes.length) return null;
  if (partes.some((p) => p === 'node_modules')) return null;
  const arquivo = partes.pop();
  const nomeArquivo = arquivo.replace(/\.[^.]+$/, '');
  const resultado = (camada, chave, motivo) => ({ ...camada, palavra: chave, motivo });

  // 1) Nome do arquivo: "usuarioController.js", "Modelusuario.js", "db.js"
  const pelaArquivo = camadaDoNome(nomeArquivo);
  if (pelaArquivo) return resultado(pelaArquivo.camada, pelaArquivo.chave, `pelo nome do arquivo \`${arquivo}\``);

  // 2) Pastas, da mais próxima para a mais distante (no máximo 4 níveis): "src/models/Usuario.js"
  const pastas = partes.filter((p) => !/^[A-Za-z]:$/.test(p)).slice(-4).reverse();
  for (const pasta of pastas) {
    const pelaPasta = camadaDoNome(pasta);
    if (pelaPasta) return resultado(pelaPasta.camada, pelaPasta.chave, `pela pasta \`${pasta}\``);
  }

  // 3) Arquivo de entrada do servidor: server.js, app.js, index.js...
  const nomeSimples = semAcento(nomeArquivo).toLowerCase();
  if (SERVIDOR.arquivos.includes(nomeSimples)) return resultado(SERVIDOR, nomeSimples, `pelo nome do arquivo \`${arquivo}\``);
  return null;
}

/** Dica específica para o erro nesta camada (ou de banco de dados, que vale em qualquer camada). */
function dicaDaCamada(camada, mensagem) {
  if (!mensagem) return null;
  for (const [re, texto] of DICAS_BANCO) if (re.test(mensagem)) return texto;
  if (!camada) return null;
  for (const [re, texto] of camada.dicas ?? []) if (re.test(mensagem)) return texto;
  return null;
}

/**
 * Resume o caminho das chamadas por camada, de fora para dentro: "🛣️ Rota → 🎮 Controller → 🗃️ Model".
 * @param {Array<{ camada: object|null }>} quadros  da pilha, de DENTRO para FORA (como o Node imprime)
 * @returns {string|null}  null quando há menos de duas camadas diferentes
 */
function resumirCaminho(quadros) {
  const sequencia = [];
  for (const q of [...quadros].reverse()) {
    if (!q.camada) continue;
    if (sequencia[sequencia.length - 1] !== q.camada.id) sequencia.push(q.camada.id);
  }
  if (sequencia.length < 2) return null;
  const porId = new Map([...CAMADAS, SERVIDOR].map((c) => [c.id, c]));
  return sequencia.map((id) => `${porId.get(id).emoji} ${porId.get(id).nome}`).join(' → ');
}

/** Descrição curta, em Markdown: "🗃️ **Model** (pela pasta `models`) — representa os dados..." */
function descreverCamada(camada) {
  return `${camada.emoji} **${camada.nome}** (${camada.motivo}) — ${camada.papel}`;
}

module.exports = { identificarCamada, dicaDaCamada, resumirCaminho, descreverCamada, CAMADAS };
