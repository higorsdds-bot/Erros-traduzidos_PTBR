# AGENTS.md — Contexto Técnico para Agentes

Este documento fornece contexto completo para qualquer agente de IA trabalhar no projeto **Tradutor de Erros (PT-BR)** sem precisar explorar todo o repositório do zero.

---

## 1. Visão Geral do Projeto

- **Nome da extensão:** `tradutor-de-erros` (**Tradutor de Erros (PT-BR)**)
- **Publicador:** `ZeniF` (`version`: `0.1.1`, licença `MIT`)
- **Engine mínima:** `vscode` `^1.80.0`
- **Editores compatíveis:** VS Code, Antigravity, Cursor, Windsurf, VSCodium e derivados baseados no VS Code.
- **Propósito:** Exibir diagnósticos do editor (erros, avisos, informações e dicas) simultaneamente em inglês e português brasileiro (PT-BR), acompanhados de vocabulário técnico para quem está aprendendo a programar.
- **Links do projeto:**
  - Repositório: `https://github.com/higorsdds-bot/Erros-traduzidos_PTBR`
  - Open VSX: `https://open-vsx.org/extension/ZeniF/tradutor-de-erros`
- **Stack técnica:**
  - JavaScript CommonJS puro (`require` / `module.exports`).
  - **Zero dependências npm de runtime** (não há `node_modules` nem `package-lock.json`).
  - **Sem etapa de build ou transpilação**: os arquivos `.js` são executados diretamente pelo host de extensões do VS Code.
  - Utiliza apenas a API nativa `vscode` e APIs nativas do Node.js (`fetch`, `AbortController`, `Map`).

---

## 2. Estrutura do Repositório

> **Atenção:** O repositório Git fica dentro da subpasta `Erros-traduzidos_PTBR/`, e não na pasta pai `TesteDeErros/`.

| Arquivo | Função | Vai para o `.vsix`? |
|---|---|---|
| `extension.js` | Ponto de entrada (`activate`, `deactivate`), HoverProvider, decorações inline, OutputChannel, comandos, cache em memória e fallback online. | Sim |
| `tradutor.js` | Dicionário offline de regras regex (`regras`), tradutor local (`traduzirLocal`) e extrator de vocabulário técnico (`encontrarVocabulario`). | Sim |
| `analisador.js` | Analisador de causa para JS/TS: tokeniza o arquivo e, a partir de um diagnóstico, devolve a causa real, o local exato, dica, exemplo e correção (`analisar(texto, diag)`). Também entende erros de execução (`Cannot read properties of undefined`, `x is not a function`, `is not iterable`, `Assignment to constant variable`) com o prefixo `TypeError:` etc. Não depende de `vscode`. | Sim |
| `erro-colado.js` | Lê um erro copiado do terminal/console (Node, navegador, Python): `interpretarErro(texto)` → `{ principal, mensagens, tipo, local: { caminho, linha, coluna, codigo, marcador } }` (base 1); `colunaNoArquivo` converte o `^^^` em coluna do arquivo; `REGEX_LINHA_ERRO` é usada pelos links do terminal. Não depende de `vscode`. | Sim |
| `modulos.js` | Causa de erros de módulo olhando o disco: `analisarModulo(info, arquivoImportador, texto, linha)` — arquivo inexistente (sugere o nome parecido), `.js` esquecido no import ESM, pacote não instalado (sugere o instalado), nome não exportado / `export default` (lê os exports do outro arquivo). Usa `fs`, não depende de `vscode`. | Sim |
| `teste-projetos.js` | 18 cenários de projetos Express (CJS e ESM) com saídas reais do Node 24, montando um mini projeto em pasta temporária. Sai com código 1 em falha. | Não (`.vscodeignore`) |
| `teste-erro-colado.js` | Teste com 10 saídas reais (Node, Chrome, Python). Sai com código 1 em falha. | Não (`.vscodeignore`) |
| `referencia-js.js` | Referência rápida de JavaScript em PT-BR (baseada na MDN), listas de palavras reservadas/chaves/globais e métodos por tipo. Usada pelo `analisador.js` e pelo hover. | Sim |
| `teste-analisador.js` | Teste do analisador com 42 casos (mensagens e posições reais do TypeScript). Sai com código 1 se algum falhar. | Não (`.vscodeignore`) |
| `package.json` | Manifesto da extensão: metadados, `activationEvents`, `commands`, `configuration` (`tradutorErros.*`) e categorias. | Sim |
| `README.md` | Documentação voltada ao usuário final (exibida nas lojas VS Code Marketplace e Open VSX). | Sim |
| `icone.png` | Ícone da extensão exibido nas lojas e no painel de extensões. | Sim |
| `LICENSE` | Licença MIT. | Sim |
| `AGENTS.md` | Documentação de contexto técnico para agentes de IA (este arquivo). | Não (`.vscodeignore`) |
| `teste-dicionario.js` | Script manual de fumaça para validar `traduzirLocal` com 20 exemplos de mensagens. | Não (`.vscodeignore`) |
| `publicar.ps1` | Script PowerShell de automação para testar, versionar, empacotar `.vsix` e publicar no VS Code Marketplace e Open VSX. | Não (`.vscodeignore`) |
| `.gitignore` | Ignora `*.vsix` e `node_modules/`. | Não (`.vscodeignore`) |
| `.vscodeignore` | Lista arquivos excluídos do empacotamento `.vsix`. | — |

---

## 3. Arquitetura e Fluxo de Execução (`extension.js`)

### Ativação e Ciclo de Vida

- **`activationEvents`:** `["onStartupFinished"]` (ativa assim que o editor termina de iniciar).
- **`activate(context)`:**
  - Cria `decoracao` via `vscode.window.createTextEditorDecorationType` com estilo `after: { margin: '0 0 0 2em', fontStyle: 'italic' }` e `rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed`.
  - Cria `canalSaida` via `vscode.window.createOutputChannel('Tradutor de Erros')`.
  - Registra `HoverProvider` global para todos os idiomas (`'*'`) apontando para `criarHover`.
  - Registra listeners que disparam `agendarAtualizacao()` (debounce de `300` ms):
    - `vscode.languages.onDidChangeDiagnostics`
    - `vscode.window.onDidChangeVisibleTextEditors`
    - `vscode.workspace.onDidChangeConfiguration` (filtrado por `e.affectsConfiguration('tradutorErros')`)
  - Registra os comandos `tradutorErros.listar`, `tradutorErros.alternarLinha` e `tradutorErros.limparCache`.
  - Chama `agendarAtualizacao()` imediatamente para decorar editores já abertos.
- **`deactivate()`:** limpa `temporizador` via `clearTimeout(temporizador)`.

### Pipeline de Tradução (`traduzir(mensagem)`)

1. **Cache em memória:** verifica `cache` (`Map<string, { texto, fonte }>`). Se existir, retorna imediatamente.
2. **Tradução local linha a linha:** divide `mensagem` por `/\r?\n/` e chama `traduzirLocal(linha)` em cada linha.
3. **Fallback online para linhas pendentes:** identifica índices onde `traduzirLocal` retornou `null` (`pendentes`). Se houver pendências:
   - Retorna `null` sem fazer requisição se `tradutorErros.traducaoOnline` for `false` **ou** se `mensagem` estiver em `falhas` (`Map<string, number>`) há menos de `ESPERA_APOS_FALHA` (`60_000` ms).
   - Junta as linhas pendentes com `\n` e chama `traduzirOnline(textoPendente)`, que faz `fetch` no endpoint não-oficial do Google Tradutor:
     `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=...`
     com timeout de `4000` ms via `AbortController`.
   - Se a requisição falhar, não retornar `resposta.ok`, ou lançar exceção de rede/parse, grava `Date.now()` em `falhas` para `mensagem` e retorna `null`.
   - Se `partes.length !== pendentes.length` (o tradutor juntou ou quebrou linhas), coloca `online` inteiro na primeira linha pendente e `''` nas demais.
4. **Composição e cacheamento:** define `fonte` como:
   - `'dicionário'` (todas as linhas traduzidas localmente),
   - `'tradução automática'` (todas via online), ou
   - `'dicionário + tradução automática'` (misto).
   Armazena `{ texto, fonte }` em `cache` (filtrando linhas vazias ao juntar com `\n`) e retorna o objeto.

### Superfícies de Interface (UI)

- **Hover (`criarHover` + `diagnosticosNaPosicao`):**
  - Respeita `tradutorErros.ativado`.
  - Seleciona diagnósticos cujo `range.contains(posicao)` ou `(d.range.isEmpty && d.range.start.line === posicao.line)`.
  - Para cada diagnóstico, exibe:
    - Severidade e fonte: `🔴 **Erro**`, `🟡 **Aviso**`, `🔵 **Informação**`, `💡 **Dica**` (mapeados por `ICONES` e `NOMES`) seguido de `(${d.source})` quando presente.
    - Mensagem original (`🇺🇸 `) e tradução (`🇧🇷 **...**` + `_fonte: ..._`, ou aviso para ativar a tradução online).
    - Se `tradutorErros.mostrarVocabulario` estiver ativo e `encontrarVocabulario(d.message)` retornar itens, exibe `📚 **Vocabulário:** \`termo\` = explicação` separados por ` · `.
- **Decoração no fim da linha (`atualizarEditor`):**
  - Limpa decorações se `!ativado || !mostrarNaLinha`.
  - Filtra diagnósticos por `severidadeNaLinha` usando `NIVEIS = { erro: 0, aviso: 1, informacao: 2, dica: 3 }`.
  - Mantém apenas **um diagnóstico por linha**: o de menor valor numérico de `severity` (mais grave).
  - Colapsa quebras de linha em espaço único, trunca mensagens com mais de 140 caracteres (`texto.slice(0, 137) + '...'`) e posiciona em `documento.lineAt(linha).range.end` com `ThemeColor` (`CORES`: `editorError.foreground`, `editorWarning.foreground`, `editorInfo.foreground`, `editorHint.foreground`).
  - Verifica `if (documento.version !== versao) return;` após os `await` de tradução para não aplicar decorações desatualizadas se o usuário editou o arquivo durante a requisição.
- **Lista completa (`listarErros`):**
  - Lê diagnósticos do `activeTextEditor`, limpa e preenche o `OutputChannel` `'Tradutor de Erros'` com linha e coluna (base 1), severidade, `source`, texto original (`🇺🇸`) e traduzido (`🇧🇷`), e abre o painel sem roubar o foco (`canalSaida.show(true)`).

---

## 4. Contratos da Extensão (`package.json`)

### Comandos

| ID do Comando | Título na Paleta | Comportamento |
|---|---|---|
| `tradutorErros.listar` | `Tradutor de Erros: Listar erros do arquivo traduzidos` | Lista todos os diagnósticos do editor ativo no OutputChannel `'Tradutor de Erros'`. |
| `tradutorErros.alternarLinha` | `Tradutor de Erros: Mostrar/ocultar tradução no fim da linha` | Alterna `tradutorErros.mostrarNaLinha` usando `ConfigurationTarget.Global`. |
| `tradutorErros.limparCache` | `Tradutor de Erros: Limpar cache de traduções` | Limpa `cache` e `falhas`, chama `agendarAtualizacao()` e exibe mensagem informativa. |

### Configurações (`tradutorErros.*`)

| Chave | Tipo | Padrão | Valores / Efeito |
|---|---|---|---|
| `tradutorErros.ativado` | `boolean` | `true` | Liga/desliga hover e decorações inline. |
| `tradutorErros.mostrarNaLinha` | `boolean` | `true` | Habilita/desabilita traduções inline no fim da linha. |
| `tradutorErros.severidadeNaLinha` | `string` | `"aviso"` | `"erro"`, `"aviso"`, `"informacao"`, `"dica"` — severidade mínima para exibição inline. |
| `tradutorErros.traducaoOnline` | `boolean` | `true` | Permite fallback ao Google Tradutor quando a mensagem não está no dicionário local. |
| `tradutorErros.mostrarVocabulario` | `boolean` | `true` | Exibe termos técnicos traduzidos no hover. |

---

## 5. Dicionário Offline e Vocabulário (`tradutor.js`)

- **Exportações:** `{ traduzirLocal, encontrarVocabulario }`.
- **Cobertura atual:**
  - **`regras`:** **361 regras** divididas em 5 seções:
    - JavaScript / TypeScript: **260** (inclui mensagens do TypeScript, erros de execução da MDN — V8/Chrome/Node, Firefox, Safari — e ESLint/espree)
    - Python (Pylance / Pylint / Flake8): **45**
    - Java: **40**
    - PHP (Intelephense): **14**
    - C#: **2**
  - **`vocabulario`:** **112** termos e expressões em inglês técnico mapeados para explicações curtas em PT-BR.

### Mecânica de Correspondência

- **Helper `rx(padrao)`:**
  - Constrói `new RegExp('^(?:' + padrao.replace(/Q/g, Q) + ')\\.?$', 'i')`, onde `Q = "['\"\`]"` (aspas simples, duplas ou crase).
  - Sempre ancorado (`^...\.?$`) e case-insensitive (`i`).
- **`traduzirFrase(frase)`:**
  - Faz `trim()` e remove ponto final (`.$`) para evitar que capturas gulosas `(.+)` absorvam o ponto.
  - Percorre `regras` sequencialmente (primeira correspondência vence).
  - Se o segundo elemento da regra for string, substitui `$1`..`$9` via `/\$(\d)/g`.
  - Se for função, invoca `traducao(...m.slice(1), traduzirLocal)` — usada, por exemplo, na regra recursiva `Parsing error: (.+)` e na concordância de gênero de `method|field` em Java. Se a função retornar falsy, continua testando as regras seguintes.
- **`traduzirLocal(linha)`:**
  - Tenta traduzir a linha inteira com `traduzirFrase(linha)`.
  - Se não casar, divide a linha em frases usando `/(?<=[.?!])\s+(?=[A-Z])/` (ex.: `"Cannot find name 'x'. Did you mean 'y'?"`). Só retorna a junção se **todas** as frases forem traduzidas (não-`null`).
- **`encontrarVocabulario(mensagem)`:**
  - Testa cada chave de `vocabulario` com `\b...\b` (espaços convertidos em `\s+`, case-insensitive).
  - Filtra termos simples que já estão contidos em uma expressão composta também encontrada na mesma mensagem (ex.: remove `exist` se `does not exist` também deu match).

### Analisador de causa (`analisador.js`) e referência (`referencia-js.js`)

- **Por quê:** o TypeScript (motor de JS do VS Code) costuma apontar o lugar errado — ex.: `funtion somar() {` gera `';' expected` na `{`. O analisador lê o código e acha a causa real.
- **Entrada/saída:** `analisar(texto, { linha, coluna, mensagem, codigo })` (base 0) → `{ causa, local: { linha, col, fimCol }, dica?, exemplo?, correcao?: { titulo, linha, col, fimLinha, fimCol, texto }, refs: [], consequencia? }` ou `null`. `causa`/`dica` são Markdown (código entre crases).
- **Análises:** palavra-chave escrita errado/maiúscula (distância Damerau, só em posição onde caberia palavra-chave e se o nome não for declarado), `await` sem `async` (acha a função que envolve; casos `forEach`/`map`/`then`/método/topo), delimitadores ( `;` dentro de `(`/`[`, fechamento sobrando, `{` não fechada pela indentação), vírgula faltando, valores lado a lado, string/template não fechada, caractere inválido, `= >`, `if` sem parênteses, palavra reservada como nome, `const` reatribuída, redeclaração, uso antes da declaração, propriedade/nome com erro de digitação (`metodosPorTipo`), `.json()` sem `await`.
- **Regra de ouro:** se não houver certeza, devolver `null` (a extensão mostra só a tradução). Nunca inventar causa.
- **Na extensão:** só para `javascript`, `javascriptreact`, `typescript`, `typescriptreact`; cache por versão do documento (`analises`); hover com trecho marcado `^^^`, decoração `decoracaoLocal` no ponto exato, `CodeActionProvider` com a `correcao`. Configs `tradutorErros.analisarCausa` e `tradutorErros.mostrarReferencia`.
- **Erros do terminal (`extension.js`):** comandos `tradutorErros.traduzirErroCopiado` (área de transferência, ou caixa para colar; aceita o texto como argumento) e `tradutorErros.traduzirSelecaoTerminal` (menu `terminal/context`); `registerTerminalLinkProvider` cria link em linhas que casam com `REGEX_LINHA_ERRO`. Ao clicar, o contexto (arquivo:linha acima, pilha abaixo) vem da saída capturada por `onDidStartTerminalShellExecution` (VS Code 1.93+, detectado em tempo de execução; engine continua `^1.80.0`) ou, sem integração de shell, de "selecionar tudo + copiar" no terminal (restaurando a área de transferência). A explicação é um documento virtual `tradutor-erros:` aberto com `markdown.showPreviewToSide`, e o arquivo do erro é aberto com a seleção no ponto exato. `findFiles` tem tempo limite de 3 s.
- **Testes de integração:** foram feitos com `@vscode/test-electron` fora do repositório (sem adicionar dependência). Observado: na cópia baixada pelo test-electron os terminais não iniciam neste Windows; com o VS Code instalado (`vscodeExecutablePath` + `--user-data-dir` separado) funcionam. A área de transferência não funciona na instância de teste, então o plano B dos links (selecionar tudo + copiar) não tem teste automatizado.
- **Testar:** `node teste-analisador.js` e `node teste-erro-colado.js`. Para gerar casos novos com mensagens reais, use o pacote `typescript` fora do repositório (não adicionar dependência ao projeto).

---

## 6. Fluxos Comuns de Desenvolvimento, Teste e Publicação

### Adicionar ou ajustar regras no dicionário

1. Edite `regras` em `tradutor.js`, inserindo a nova entrada na seção da linguagem correspondente e **antes** de regras mais genéricas que possam capturá-la.
2. Adicione um caso representativo ao array `exemplos` em `teste-dicionario.js`.
3. Execute o teste de fumaça dentro de `Erros-traduzidos_PTBR/`:
   ```powershell
   node teste-dicionario.js
   ```
   Confirme que o novo exemplo foi traduzido corretamente e que a contagem final subiu conforme esperado (atualmente `19/20 traduzidos pelo dicionário.`, pois o último item é um caso negativo proposital).

### Testar a extensão no editor

- **Modo desenvolvimento:** abra a pasta `Erros-traduzidos_PTBR/` no VS Code e pressione `F5` para abrir uma janela *Extension Development Host*.
- **Via pacote `.vsix`:**
  ```powershell
  npx @vscode/vsce package
  code --install-extension tradutor-de-erros-0.1.1.vsix
  ```

### Publicar uma nova versão (`publicar.ps1`)

- Uso dentro de `Erros-traduzidos_PTBR/`:
  - `.\publicar.ps1` (publica versão atual)
  - `.\publicar.ps1 patch` / `minor` / `major` (incrementa `package.json` e publica)
- O script executa nesta ordem:
  1. Lê `VSCE_PAT` (VS Code Marketplace) e `OVSX_PAT` (Open VSX) das variáveis de ambiente de Processo ou Usuário.
  2. Roda `node teste-dicionario.js`.
  3. Opcionalmente incrementa a versão com `npm version <tipo> --no-git-tag-version`.
  4. Remove `.vsix` antigos e empacota o novo com `npx --yes @vscode/vsce package --out $vsix`.
  5. Publica no VS Code Marketplace (se houver `VSCE_PAT`) e no Open VSX via `ovsx` (criando o namespace `ZeniF` automaticamente caso não exista).

---

## 7. Convenções do Projeto

- **Idioma único:** identificadores, nomes de funções/variáveis, comentários, chaves de configuração (`tradutorErros.*`), mensagens ao usuário e commits devem ser escritos em **português (PT-BR)**.
- **Simplicidade e zero dependências:** manter o projeto sem dependências externas de runtime e sem bundler/transpilador, salvo solicitação explícita.
- **Estilo das traduções:** claro, direto e didático para iniciantes; quando útil, incluir breve explicação entre parênteses e preservar nomes de símbolos/tipos entre aspas simples ou duplas.
- **Controle de pacote:** ao criar qualquer arquivo auxiliar, teste ou documentação interna que não deva ir para a extensão publicada, adicioná-lo ao `.vscodeignore`.

---

## 8. Armadilhas e Pontos de Atenção (Pitfalls)

1. **`Q` maiúsculo dentro de `rx(...)`:** `rx` faz `padrao.replace(/Q/g, Q)`. Qualquer `Q` maiúsculo no padrão é convertido em `['"\`]`. Nunca use `Q` maiúsculo como letra literal dentro de `rx(...)` (ex.: `SQL`, `Query`, `Queue`) — use minúsculas (já que `rx` usa a flag `i`) ou crie uma regex literal.
2. **Nunca escreva `\\Q` dentro de `rx(...)`:** a barra escapa o colchete da classe `['"\`]` e a regra nunca casa (era o bug das regras `Qundefined\\Q` e `Qsuper\\Q`, já corrigido). `rx` agora envolve o padrão em `(?:...)`, então alternativas `a|b` são seguras — mas um prefixo como `(?:SyntaxError: )?` só vale para todas as alternativas se elas estiverem dentro de um grupo.
3. **Ordem de precedência em `regras`:** o array é avaliado de cima para baixo com parada no primeiro match. Regras específicas (ex.: `Syntax error on token "(.+?)", (.+?) expected after this token`) precisam ficar acima de regras genéricas (`Syntax error, (.+)`).
4. **Limite de placeholders (`$1`–`$9`):** `traducao.replace(/\$(\d)/g, ...)` captura apenas um dígito. Não crie regras em string com 10 ou mais grupos de captura; use função de callback se precisar disso.
5. **Comportamento tudo-ou-nada no fallback e em múltiplas frases:**
   - Em `traduzir()`, se uma mensagem multilinha tiver linhas traduzidas localmente e outras pendentes, e a tradução online falhar ou estiver desativada, a função retorna `null` para a mensagem inteira.
   - Em `traduzirLocal()`, o fallback por frases só retorna resultado se **todas** as frases da linha forem reconhecidas pelo dicionário.
6. **Limitações da suíte de testes:**
   - `teste-dicionario.js` não retorna código de saída diferente de zero quando uma regra falha em casar (sempre sai com `0` se não houver erro de sintaxe/exceção). É obrigatório conferir a saída e a proporção final no terminal.
   - O analisador tem teste próprio (`teste-analisador.js`, sai com código 1 em falha). Não existem testes automatizados para `encontrarVocabulario()` nem para `extension.js` (UI, cache, debounce e chamada online).
7. **Versionamento no `publicar.ps1` e `README.md`:** `publicar.ps1` usa `--no-git-tag-version` (o commit e a tag git precisam ser feitos manualmente), e o `README.md` possui o número de versão fixo no exemplo de instalação local.
