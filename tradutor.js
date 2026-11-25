// Dicionário offline de mensagens de erro (inglês -> português).
// Cada regra: [expressão regular, tradução]. A tradução pode usar $1, $2...
// ou ser uma função (grupos..., traduzir) => string | null.

const Q = `['"\`]`; // qualquer tipo de aspas

function rx(padrao) {
  // Permite escrever Q no lugar de "qualquer aspas" e aceita ponto final opcional.
  return new RegExp('^' + padrao.replace(/Q/g, Q) + '\\.?$', 'i');
}

const regras = [
  // ---------------- JavaScript / TypeScript ----------------
  [rx("Cannot find name Q(.+?)Q"), "Não foi possível encontrar o nome '$1' (não foi declarado ou está escrito errado)."],
  [rx("Did you mean Q(.+?)Q\\?"), "Você quis dizer '$1'?"],
  [rx("Did you mean to use Q(.+?)Q\\?"), "Você quis usar '$1'?"],
  [rx("Q(.+?)Q expected"), "Era esperado '$1' aqui (está faltando '$1')."],
  [rx("(\\S) expected"), "Era esperado '$1' aqui (está faltando '$1')."],
  [rx("Expected (\\d+) arguments?, but got (\\d+)"), "Eram esperados $1 argumento(s), mas foram passados $2."],
  [rx("Expected at least (\\d+) arguments?, but got (\\d+)"), "Eram esperados pelo menos $1 argumento(s), mas foram passados $2."],
  [rx("Expected (\\d+)-(\\d+) arguments?, but got (\\d+)"), "Eram esperados de $1 a $2 argumentos, mas foram passados $3."],
  [rx("Expected (\\d+) type arguments?, but got (\\d+)"), "Eram esperados $1 argumento(s) de tipo, mas foram passados $2."],
  [rx("An argument for Q(.+?)Q was not provided"), "Não foi passado um argumento para o parâmetro '$1'."],
  [rx("Property Q(.+?)Q does not exist on type Q(.+)Q"), "A propriedade '$1' não existe no tipo '$2'."],
  [rx("Property Q(.+?)Q is missing in type Q(.+?)Q but required in type Q(.+)Q"), "A propriedade '$1' está faltando no tipo '$2', mas é obrigatória no tipo '$3'."],
  [rx("Property Q(.+?)Q has no initializer and is not definitely assigned in the constructor"), "A propriedade '$1' não tem valor inicial e não recebe valor no construtor."],
  [rx("Type Q(.+?)Q is missing the following properties from type Q(.+?)Q: (.+)"), "O tipo '$1' não tem as seguintes propriedades exigidas pelo tipo '$2': $3"],
  [rx("Type Q(.+?)Q is not assignable to type Q(.+)Q"), "O tipo '$1' não pode ser atribuído ao tipo '$2'."],
  [rx("Argument of type Q(.+?)Q is not assignable to parameter of type Q(.+)Q"), "Um argumento do tipo '$1' não pode ser passado para um parâmetro do tipo '$2'."],
  [rx("Object literal may only specify known properties, and Q(.+?)Q does not exist in type Q(.+)Q"), "O objeto só pode ter propriedades conhecidas, e '$1' não existe no tipo '$2'."],
  [rx("Q(.+?)Q is declared but its value is never read"), "'$1' foi declarado, mas seu valor nunca é lido (não está sendo usado)."],
  [rx("Q(.+?)Q is declared but never used"), "'$1' foi declarado, mas nunca é usado."],
  [rx("All imports in import declaration are unused"), "Nenhuma das importações desta linha está sendo usada."],
  [rx("All variables are unused"), "Nenhuma das variáveis está sendo usada."],
  [rx("Cannot redeclare block-scoped variable Q(.+?)Q"), "Não é possível declarar de novo a variável '$1' no mesmo bloco."],
  [rx("Duplicate identifier Q(.+?)Q"), "Identificador '$1' duplicado (o mesmo nome foi declarado duas vezes)."],
  [rx("Duplicate function implementation"), "Implementação de função duplicada."],
  [rx("Unreachable code detected"), "Código inalcançável detectado (este código nunca será executado)."],
  [rx("Identifier expected"), "Era esperado um identificador (um nome de variável, função etc.)."],
  [rx("Expression expected"), "Era esperada uma expressão."],
  [rx("Argument expression expected"), "Era esperada uma expressão como argumento."],
  [rx("Declaration or statement expected"), "Era esperada uma declaração ou instrução."],
  [rx("Property assignment expected"), "Era esperada a atribuição de uma propriedade (chave: valor)."],
  [rx("Property or signature expected"), "Era esperada uma propriedade ou assinatura."],
  [rx("Type expected"), "Era esperado um tipo."],
  [rx("A constructor, method, accessor, or property was expected"), "Era esperado um construtor, método, acessor ou propriedade."],
  [rx("Unterminated string literal"), "String não finalizada: falta fechar as aspas."],
  [rx("Unterminated template literal"), "Template string não finalizada: falta fechar a crase (`)."],
  [rx("Unterminated regular expression literal"), "Expressão regular não finalizada."],
  [rx("Unexpected token"), "Símbolo (token) inesperado."],
  [rx("Unexpected token:? Q?(.+?)Q?"), "Símbolo inesperado: '$1'."],
  [rx("Unexpected keyword or identifier"), "Palavra-chave ou identificador inesperado."],
  [rx("Unexpected end of input"), "Fim inesperado do código (provavelmente falta fechar algo, como } ou ))."],
  [rx("Invalid character"), "Caractere inválido."],
  [rx("Object is possibly Q(null|undefined)Q"), "O objeto pode ser '$1'."],
  [rx("Q(.+?)Q is possibly Q(null|undefined)Q"), "'$1' pode ser '$2' (verifique antes de usar)."],
  [rx("Q(.+?)Q is of type Q(.+?)Q"), "'$1' é do tipo '$2'."],
  [rx("Cannot find module Q(.+?)Q or its corresponding type declarations"), "Não foi possível encontrar o módulo '$1' ou suas declarações de tipo."],
  [rx("Cannot find module Q(.+?)Q"), "Não foi possível encontrar o módulo '$1'."],
  [rx("Module Q(.+?)Q has no exported member Q(.+?)Q"), "O módulo '$1' não exporta nenhum membro chamado '$2'."],
  [rx("Variable Q(.+?)Q is used before being assigned"), "A variável '$1' é usada antes de receber um valor."],
  [rx("Block-scoped variable Q(.+?)Q used before its declaration"), "A variável '$1' foi usada antes de ser declarada."],
  [rx("Cannot assign to Q(.+?)Q because it is a constant"), "Não é possível atribuir um valor a '$1' porque é uma constante (const)."],
  [rx("Cannot assign to Q(.+?)Q because it is a read-only property"), "Não é possível atribuir um valor a '$1' porque é uma propriedade somente leitura."],
  [rx("Parameter Q(.+?)Q implicitly has an? Q(.+?)Q type"), "O parâmetro '$1' tem implicitamente o tipo '$2' (adicione um tipo explícito)."],
  [rx("Variable Q(.+?)Q implicitly has an? Q(.+?)Q type"), "A variável '$1' tem implicitamente o tipo '$2'."],
  [rx("Function lacks ending return statement and return type does not include Qundefined\\Q"), "A função não tem 'return' no final e o tipo de retorno não inclui 'undefined'."],
  [rx("A function whose declared type is neither Q(.+?)Q nor Q(.+?)Q must return a value"), "Uma função cujo tipo declarado não é '$1' nem '$2' precisa retornar um valor."],
  [rx("Not all code paths return a value"), "Nem todos os caminhos do código retornam um valor."],
  [rx("This expression is not callable"), "Esta expressão não pode ser chamada como função."],
  [rx("Operator Q(.+?)Q cannot be applied to types Q(.+?)Q and Q(.+?)Q"), "O operador '$1' não pode ser usado entre os tipos '$2' e '$3'."],
  [rx("No overload matches this call"), "Nenhuma versão (sobrecarga) desta função aceita esses argumentos."],
  [rx("Constructors for derived classes must contain a Qsuper\\Q call"), "Construtores de classes filhas precisam chamar 'super()'."],
  [rx("Q(.+?)Q only refers to a type, but is being used as a value here"), "'$1' é apenas um tipo, mas está sendo usado como valor aqui."],
  [rx("Q(.+?)Q refers to a value, but is being used as a type here"), "'$1' é um valor, mas está sendo usado como tipo aqui."],
  [rx("Type annotations can only be used in TypeScript files"), "Anotações de tipo só podem ser usadas em arquivos TypeScript."],
  [rx("Cannot use import statement outside a module"), "Não é possível usar 'import' fora de um módulo."],
  [rx("Q(.+?)Q is deprecated"), "'$1' está obsoleto (deprecated) — prefira uma alternativa mais nova."],
  [rx("Q(.+?)Q is not defined"), "'$1' não está definido (não foi declarado ou o nome está errado)."],
  [rx("Q(.+?)Q is assigned a value but never used"), "'$1' recebe um valor, mas nunca é usado."],
  [rx("Q(.+?)Q is defined but never used"), "'$1' foi definido, mas nunca é usado."],
  [rx("Missing semicolon"), "Falta ponto e vírgula (;)."],
  [rx("Extra semicolon"), "Ponto e vírgula a mais."],
  [rx("Unnecessary semicolon"), "Ponto e vírgula desnecessário."],
  [rx("Unexpected console statement"), "Uso de console inesperado (evite deixar console.log no código final)."],
  [rx("Expected Q(.+?)Q and instead saw Q(.+?)Q"), "Era esperado '$1', mas foi encontrado '$2'."],
  [rx("Strings must use singlequote"), "Strings devem usar aspas simples (')."],
  [rx("Strings must use doublequote"), "Strings devem usar aspas duplas (\")."],
  [/^Parsing error: (.+)$/i, (resto, t) => { const r = t(resto); return r ? 'Erro de análise (sintaxe): ' + r : null; }],
  [rx('"(.+?)": Unknown word'), '"$1": palavra desconhecida (possível erro de digitação).'],

  // ---------------- Python (Pylance / Pylint / Flake8) ----------------
  [rx('Import "(.+?)" could not be resolved from source'), 'O import "$1" não foi encontrado (o pacote provavelmente não está instalado).'],
  [rx('Import "(.+?)" could not be resolved'), 'Não foi possível encontrar o import "$1" (módulo inexistente ou não instalado).'],
  [rx('"(.+?)" is unknown import symbol'), '"$1" não existe nesse módulo (símbolo de import desconhecido).'],
  [rx("Expected expression"), "Era esperada uma expressão."],
  [rx("Expected indented block"), "Era esperado um bloco indentado (faltou recuar o código com espaços/tab)."],
  [rx("Unindent not expected"), "Recuo (desindentação) inesperado."],
  [rx("Unexpected indentation"), "Indentação inesperada (há espaços/tab a mais no início da linha)."],
  [rx("Unindent amount does not match previous indent"), "O recuo não corresponde a nenhum nível de indentação anterior."],
  [rx('"(.+?)" is not accessed'), '"$1" não é acessado (não está sendo usado).'],
  [rx('Argument missing for parameter "(.+?)"'), 'Falta o argumento para o parâmetro "$1".'],
  [rx("Arguments missing for parameters (.+)"), "Faltam argumentos para os parâmetros $1."],
  [rx("Expected (\\d+) positional arguments?"), "Eram esperados $1 argumento(s) posicionais."],
  [rx('No parameter named "(.+?)"'), 'Não existe parâmetro chamado "$1".'],
  [rx('Cannot access attribute "(.+?)" for class "(.+?)"'), 'Não é possível acessar o atributo "$1" da classe "$2".'],
  [rx('Cannot access member "(.+?)" for type "(.+?)"'), 'Não é possível acessar o membro "$1" do tipo "$2".'],
  [rx('Attribute "(.+?)" is unknown'), 'O atributo "$1" é desconhecido.'],
  [rx('"(.+?)" is not a known attribute of module "(.+?)"'), '"$1" não é um atributo conhecido do módulo "$2".'],
  [rx('"(.+?)" is not a known attribute of "None"'), '"$1" não existe em "None" (o valor pode ser None).'],
  [rx('"(.+?)" is possibly unbound'), '"$1" pode não ter sido definido (talvez só receba valor dentro de um if/try).'],
  [rx('"(.+?)" is unbound'), '"$1" não foi definido antes deste ponto.'],
  [rx("Statements must be separated by newlines or semicolons"), "Instruções devem ser separadas por quebra de linha ou ponto e vírgula."],
  [rx("String literal is unterminated"), "String não finalizada: falta fechar as aspas."],
  [rx('"(.+?)" was not closed'), '"$1" foi aberto e não foi fechado.'],
  [rx('Expected "(.+?)"'), 'Era esperado "$1".'],
  [rx("Expected class name"), "Era esperado o nome da classe."],
  [rx("Expected function name after \"def\""), 'Era esperado o nome da função depois de "def".'],
  [rx('Expected member name after "\\."'), 'Era esperado o nome de um membro depois do ".".'],
  [rx('Object of type "(.+?)" is not callable'), 'Um objeto do tipo "$1" não pode ser chamado como função.'],
  [rx('Operator "(.+?)" not supported for types "(.+?)" and "(.+?)"'), 'O operador "$1" não funciona entre os tipos "$2" e "$3".'],
  [rx("Code is unreachable"), "Código inalcançável (nunca será executado)."],
  [rx("Expression value is unused"), "O valor desta expressão não é usado."],
  [rx("Undefined variable:? Q?(.+?)Q?"), "Variável '$1' não definida."],
  [rx("undefined name Q(.+?)Q"), "Nome '$1' não definido."],
  [rx("Q(.+?)Q imported but unused"), "'$1' foi importado, mas não é usado."],
  [rx("Unused import (.+)"), "Import não usado: $1."],
  [rx("Unused variable Q(.+?)Q"), "Variável '$1' não usada."],
  [rx("Missing module docstring"), "Falta a docstring (documentação) do módulo."],
  [rx("Missing function or method docstring"), "Falta a docstring (documentação) da função ou método."],
  [rx("Missing class docstring"), "Falta a docstring (documentação) da classe."],
  [rx("Line too long \\((\\d+)/(\\d+)\\)"), "Linha muito longa ($1 caracteres; o máximo é $2)."],
  [rx("line too long \\((\\d+) > (\\d+) characters\\)"), "Linha muito longa ($1 caracteres; o máximo é $2)."],
  [rx("Trailing whitespace"), "Espaços em branco sobrando no fim da linha."],
  [rx("Missing final newline"), "Falta uma linha em branco no final do arquivo."],
  [rx("expected (\\d+) blank lines?, found (\\d+)"), "Eram esperadas $1 linha(s) em branco, mas foram encontradas $2."],
  [rx("(?:SyntaxError: )?invalid syntax"), "Erro de sintaxe: código escrito de forma inválida."],

  // ---------------- Java ----------------
  [rx("(.+?) cannot be resolved to a variable"), "$1 não pode ser resolvido como variável (não foi declarado ou o nome está errado)."],
  [rx("(.+?) cannot be resolved to a type"), "$1 não pode ser resolvido como tipo (classe não encontrada — falta o import ou o nome está errado)."],
  [rx("The import (.+?) cannot be resolved"), "O import $1 não foi encontrado."],
  [rx("The import (.+?) is never used"), "O import $1 nunca é usado."],
  [rx("(.+?) cannot be resolved"), "$1 não pode ser resolvido (não foi encontrado)."],
  [rx('Syntax error, insert "(.+?)" to complete (.+)'), 'Erro de sintaxe: insira "$1" para completar ($2).'],
  [rx('Syntax error on token "(.+?)", (.+?) expected after this token'), 'Erro de sintaxe no símbolo "$1": era esperado $2 depois dele.'],
  [rx('Syntax error on token "(.+?)", (.+?) expected before this token'), 'Erro de sintaxe no símbolo "$1": era esperado $2 antes dele.'],
  [rx('Syntax error on token "(.+?)", (.+?) expected'), 'Erro de sintaxe no símbolo "$1": era esperado $2.'],
  [rx('Syntax error on token "(.+?)", delete this token'), 'Erro de sintaxe no símbolo "$1": apague este símbolo.'],
  [rx("Syntax error on tokens, delete these tokens"), "Erro de sintaxe: apague estes símbolos."],
  [rx("Syntax error, (.+)"), "Erro de sintaxe: $1"],
  [rx("The method (.+?) in the type (.+?) is not applicable for the arguments \\((.*)\\)"), "O método $1 da classe $2 não aceita os argumentos ($3)."],
  [rx("The method (.+?) is undefined for the type (.+)"), "O método $1 não existe na classe $2."],
  [rx("The constructor (.+?) is undefined"), "O construtor $1 não existe."],
  [rx("The method (.+?) from the type (.+?) is not visible"), "O método $1 da classe $2 não é visível (é privado ou protegido)."],
  [rx("The field (.+?) is not visible"), "O campo $1 não é visível (é privado ou protegido)."],
  [rx("Type mismatch: cannot convert from (.+?) to (.+)"), "Tipos incompatíveis: não é possível converter de $1 para $2."],
  [rx("incompatible types: (.+?) cannot be converted to (.+)"), "Tipos incompatíveis: $1 não pode ser convertido para $2."],
  [rx("The value of the local variable (.+?) is not used"), "O valor da variável local $1 não é usado."],
  [rx("The value of the field (.+?) is not used"), "O valor do campo $1 não é usado."],
  [rx("This method must return a result of type (.+)"), "Este método precisa retornar um valor do tipo $1."],
  [rx("Void methods cannot return a value"), "Métodos void não podem retornar valor."],
  [rx("Missing return statement"), "Falta a instrução return."],
  [rx("Unhandled exception type (.+)"), "Exceção não tratada do tipo $1 (use try/catch ou declare 'throws')."],
  [rx("Duplicate local variable (.+)"), "Variável local $1 duplicada (já foi declarada)."],
  [rx("Duplicate method (.+?) in type (.+)"), "Método $1 duplicado na classe $2."],
  [rx("The local variable (.+?) may not have been initialized"), "A variável local $1 pode não ter sido inicializada (não recebeu valor)."],
  [rx("Unreachable code"), "Código inalcançável (nunca será executado)."],
  [rx("Resource leak: Q(.+?)Q is never closed"), "Vazamento de recurso: '$1' nunca é fechado (chame .close() ou use try-with-resources)."],
  [rx("The public type (.+?) must be defined in its own file"), "A classe pública $1 deve ficar em um arquivo com o mesmo nome ($1.java)."],
  [rx("Cannot make a static reference to the non-static (method|field) (.+)"), (tipo, nome) => `Não é possível usar ${tipo.toLowerCase() === 'method' ? 'o método' : 'o campo'} não-estático ${nome} a partir de um contexto estático (ex.: dentro do main).`],
  [rx("The operator (.+?) is undefined for the argument type\\(s\\) (.+)"), "O operador $1 não é válido para o(s) tipo(s) $2."],
  [rx("Cannot invoke (.+?) on the primitive type (.+)"), "Não é possível chamar $1 no tipo primitivo $2."],
  [rx('The declared package "(.*?)" does not match the expected package "(.*?)"'), 'O pacote declarado "$1" não corresponde ao pacote esperado "$2".'],
  [rx("The type (.+?) must implement the inherited abstract method (.+)"), "A classe $1 precisa implementar o método abstrato herdado $2."],
  [rx("Cannot instantiate the type (.+)"), "Não é possível criar uma instância (new) do tipo $1."],
  [rx("(.+?) is a raw type\\. References to generic type (.+?) should be parameterized"), "$1 é um tipo bruto. Referências ao tipo genérico $2 devem informar o tipo (ex.: List<String>)."],
  [rx("The serializable class (.+?) does not declare a static final serialVersionUID field of type long"), "A classe serializável $1 não declara o campo serialVersionUID."],
  [rx("cannot find symbol"), "Símbolo não encontrado (nome não declarado ou escrito errado)."],

  // ---------------- PHP (Intelephense) ----------------
  [rx("Undefined function Q(.+?)Q"), "Função '$1' não definida."],
  [rx("Undefined type Q(.+?)Q"), "Tipo/classe '$1' não definido."],
  [rx("Undefined method Q(.+?)Q"), "Método '$1' não definido."],
  [rx("Undefined property Q(.+?)Q"), "Propriedade '$1' não definida."],
  [rx("Undefined constant Q(.+?)Q"), "Constante '$1' não definida."],
  [rx("Syntax error: unexpected token Q(.+?)Q, expecting (.+)"), "Erro de sintaxe: símbolo inesperado '$1', era esperado $2."],
  [rx("Syntax error: unexpected token Q(.+?)Q"), "Erro de sintaxe: símbolo inesperado '$1'."],
  [rx("Syntax error: unexpected end of file, expecting (.+)"), "Erro de sintaxe: o arquivo terminou antes do esperado; era esperado $1."],
  [rx("Syntax error: unexpected end of file"), "Erro de sintaxe: o arquivo terminou antes do esperado (algo não foi fechado)."],
  [rx("Expected (\\d+) arguments?\\. Found (\\d+)"), "Eram esperados $1 argumento(s). Foram passados $2."],
  [rx("Expected type Q(.+?)Q\\. Found Q(.+?)Q"), "Era esperado o tipo '$1', mas foi encontrado '$2'."],
  [rx("Symbol Q(.+?)Q is declared but not used"), "'$1' foi declarado, mas não é usado."],
  [rx("Unexpected Q(.+?)Q\\. Expected Q(.+?)Q"), "'$1' inesperado. Era esperado '$2'."],
  [rx("Unexpected Q(.+?)Q"), "'$1' inesperado."],

  // ---------------- C# ----------------
  [rx("The name Q(.+?)Q does not exist in the current context"), "O nome '$1' não existe no contexto atual (não foi declarado ou está fora do escopo)."],
  [rx("Use of unassigned local variable Q(.+?)Q"), "Uso da variável local '$1' sem valor atribuído."],
];

function traduzirFrase(frase) {
  // Remove o ponto final para que capturas gulosas (.+) não o incluam.
  const texto = frase.trim().replace(/\.$/, '');
  if (!texto) return '';
  for (const [regex, traducao] of regras) {
    const m = texto.match(regex);
    if (!m) continue;
    if (typeof traducao === 'function') {
      const r = traducao(...m.slice(1), traduzirLocal);
      if (r) return r;
      continue;
    }
    return traducao.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
  }
  return null;
}

/** Traduz uma linha usando o dicionário. Retorna null se não souber. */
function traduzirLocal(linha) {
  const inteira = traduzirFrase(linha);
  if (inteira !== null) return inteira;
  // Tenta frase por frase: "Cannot find name 'x'. Did you mean 'y'?"
  const frases = linha.split(/(?<=[.?!])\s+(?=[A-Z])/);
  if (frases.length < 2) return null;
  const partes = frases.map(traduzirFrase);
  return partes.every((p) => p !== null) ? partes.join(' ') : null;
}

// Vocabulário para ajudar no aprendizado do inglês técnico.
const vocabulario = {
  'argument': 'argumento (valor passado para uma função)',
  'arguments': 'argumentos',
  'parameter': 'parâmetro (variável que a função recebe)',
  'parameters': 'parâmetros',
  'expected': 'esperado',
  'missing': 'faltando',
  'unexpected': 'inesperado',
  'undefined': 'indefinido / não definido',
  'defined': 'definido',
  'declared': 'declarado',
  'declaration': 'declaração',
  'statement': 'instrução / comando',
  'expression': 'expressão',
  'identifier': 'identificador (nome)',
  'type': 'tipo',
  'property': 'propriedade',
  'attribute': 'atributo',
  'variable': 'variável',
  'function': 'função',
  'method': 'método',
  'class': 'classe',
  'module': 'módulo',
  'import': 'importação',
  'return': 'retornar / retorno',
  'string': 'texto (cadeia de caracteres)',
  'literal': 'literal (valor escrito direto no código)',
  'syntax': 'sintaxe (regras de escrita da linguagem)',
  'token': 'símbolo / pedaço do código',
  'assignable': 'atribuível',
  'assigned': 'atribuído',
  'resolved': 'resolvido / encontrado',
  'unreachable': 'inalcançável',
  'never': 'nunca',
  'used': 'usado',
  'unused': 'não usado',
  'read': 'lido',
  'semicolon': 'ponto e vírgula (;)',
  'colon': 'dois-pontos (:)',
  'comma': 'vírgula (,)',
  'bracket': 'colchete [ ]',
  'brace': 'chave { }',
  'parenthesis': 'parêntese ( )',
  'quote': 'aspas',
  'indentation': 'indentação (recuo)',
  'indent': 'recuo',
  'block': 'bloco',
  'scope': 'escopo',
  'possibly': 'possivelmente',
  'null': 'nulo',
  'constant': 'constante',
  'deprecated': 'obsoleto',
  'overload': 'sobrecarga',
  'instance': 'instância',
  'interface': 'interface',
  'implicitly': 'implicitamente',
  'explicitly': 'explicitamente',
  'cannot': 'não pode',
  'find': 'encontrar',
  'name': 'nome',
  'exist': 'existir',
  'does not exist': 'não existe',
  'value': 'valor',
  'initialized': 'inicializado',
  'initializer': 'valor inicial',
  'exception': 'exceção (erro em tempo de execução)',
  'unhandled': 'não tratado',
  'mismatch': 'incompatibilidade',
  'convert': 'converter',
  'callable': 'que pode ser chamado',
  'invalid': 'inválido',
  'unterminated': 'não terminado',
  'duplicate': 'duplicado',
  'constructor': 'construtor',
  'static': 'estático',
  'unknown': 'desconhecido',
  'operator': 'operador',
  'object': 'objeto',
  'member': 'membro',
  'unbound': 'não vinculado (sem valor)',
  'accessed': 'acessado',
  'visible': 'visível',
  'field': 'campo',
  'raw': 'bruto',
  'generic': 'genérico',
  'leak': 'vazamento',
  'insert': 'inserir',
  'delete': 'apagar',
  'complete': 'completar',
  'did you mean': 'você quis dizer',
};

function encontrarVocabulario(mensagem) {
  const encontrados = [];
  const texto = mensagem.toLowerCase();
  for (const [ingles, portugues] of Object.entries(vocabulario)) {
    const re = new RegExp(`\\b${ingles.replace(/ /g, '\\s+')}\\b`, 'i');
    if (re.test(texto)) encontrados.push([ingles, portugues]);
  }
  // Remove palavras contidas em expressões maiores (ex.: "exist" quando já tem "does not exist").
  return encontrados.filter(([p]) => !encontrados.some(([o]) => o !== p && o.includes(' ') && o.split(' ').includes(p)));
}

module.exports = { traduzirLocal, encontrarVocabulario };
