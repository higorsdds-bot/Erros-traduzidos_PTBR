# Tradutor de Erros (PT-BR)

Mostra os erros e sugestões do editor **em inglês e em português**, para você aprender a programar sem travar no inglês — e aprender o inglês técnico ao mesmo tempo.

Funciona no **VS Code**, no **Antigravity**, no **Cursor** e em outros editores baseados no VS Code, com qualquer linguagem que mostre erros no editor: JavaScript, TypeScript, Python, Java, PHP, C#...

**Instalar:** procure por **Tradutor de Erros** na aba de extensões do seu editor, ou acesse o [Open VSX](https://open-vsx.org/extension/ZeniF/tradutor-de-erros) (Antigravity, Cursor, Windsurf, VSCodium).

## O que faz

**Hover com tradução**: ao passar o mouse sobre um erro, aparece:

> 🔴 **Erro** (ts) · linha 1, coluna 21
>
> 🎯 **Causa provável:** `funtion` está escrito errado: o certo é `function`.
>
> 📍 **Onde corrigir:** linha 1, coluna 1 _(não é exatamente onde o editor sublinhou)_
> ```
> 1 | funtion somar(a, b) {
>   | ^^^^^^^
> ```
> ✅ **Correção:** Trocar "funtion" por "function" — clique na lâmpada 💡 ou use `Ctrl+.`
>
> 🇺🇸 `';' expected.`
>
> 🇧🇷 _Tradução literal:_ Erro de sintaxe: o editor esperava o fim da instrução aqui. Normalmente NÃO é falta de ';'...
>
> 📖 **`function`** — Declara uma função... (com exemplo e link para a MDN)

**Causa real do erro (JavaScript/TypeScript)**: as mensagens do editor muitas vezes enganam — `';' expected` quase nunca é falta de ponto e vírgula. A extensão lê o código ao redor do erro e aponta a causa e a **posição exata**, por exemplo:

| Você escreveu | O editor diz | A extensão mostra |
|---|---|---|
| `funtion somar() {` | `';' expected` | `funtion` escrito errado → `function` |
| `const f = asnyc () => {}` | `';' expected` | `asnyc` escrito errado → `async` |
| `} elseif (x) {` | `';' expected` | use `else if`, separado |
| `console.log("Olá" nome)` | `',' expected` | falta `+` ou `,` entre `"Olá"` e `nome` |
| `const a = [1, 2, 3;` | `',' expected` | o `[` da coluna 11 não foi fechado |
| `if (x > 0 {` | `')' expected` | o `(` da coluna 4 não foi fechado |
| `'}' expected` no fim do arquivo | — | qual `{` ficou aberta (pela indentação) |
| `await` em função comum | `'await' expressions are only allowed...` | qual função precisa de `async` (e o caso do `forEach`) |
| `const r = fetch(); r.json()` | `Property 'json' does not exist on type 'Promise'` | falta `await` |
| `lista.psuh(1)`, `console.lg()` | `Property 'psuh' does not exist...` | o certo é `push`, `log` |
| `const s = “oi”` | `Invalid character` | aspas curvas copiadas de Word/WhatsApp |

Quando existe uma correção segura, ela aparece na **lâmpada 💡 (`Ctrl+.`)**. O ponto exato do problema ganha um contorno no editor, e, se ele estiver em outra linha, essa linha recebe a marca "⬅ 🎯 o problema está aqui".

**Referência de JavaScript (MDN)**: quando o erro envolve uma palavra-chave ou função pronta (`async`, `await`, `fetch`, `Promise`, `map`, `forEach`, `JSON.parse`, `setTimeout`, `getElementById`...), o hover mostra o que ela faz, um exemplo e o link para a documentação da MDN em português.

**Tradução no fim da linha**: a causa provável (ou a tradução) aparece em itálico ao lado da linha com erro, na cor do erro.

**Lista completa**: `Ctrl+Shift+P` → *Tradutor de Erros: Listar erros do arquivo traduzidos*.

**Erros do terminal e do navegador**: os erros que aparecem quando o programa **roda** (no terminal, no console do navegador, no Python) também são explicados:

- **Links no terminal**: no terminal integrado, as mensagens de erro (`TypeError: ...`, `SyntaxError: ...`, `NameError: ...`) viram links. Clique com `Ctrl` e a extensão abre o arquivo **no ponto exato do erro** e mostra a explicação ao lado.
- **Traduzir erro copiado**: copie o erro (do console do navegador, de um site, de onde for) e rode `Ctrl+Shift+P` → *Tradutor de Erros: Traduzir erro copiado*. Se não houver nada copiado, aparece uma caixa para colar.
- **Traduzir erro selecionado**: selecione o erro no terminal, clique com o botão direito → *Tradutor de Erros: Traduzir erro selecionado*.

Em projetos com várias pastas (server, routes, controllers, models), a extensão ignora o código das bibliotecas (`node_modules`), abre o **seu** arquivo, mostra o caminho das chamadas (rota → controller → model) e explica erros típicos: `require`/`import` com caminho ou nome errado, `.js` esquecido no import, export que não existe, `this` perdido no controller, `await` esquecido, `req.body` vazio (falta `express.json()`), resposta enviada duas vezes, porta ocupada e CORS.

**Camada do projeto pelo nome**: a extensão reconhece a camada de cada arquivo pelo nome do arquivo ou da pasta, mesmo com nomes diferentes: `models/Usuario.js`, `Modelusuario.js`, `modelsUsuarios.js`, `usuarioModel.js` e `usuario.model.js` são todos **Model**. O mesmo vale para as outras camadas:

| Camada | Exemplos de nome |
|---|---|
| 🛣️ Rota | `routes/`, `rotas/`, `usuarioRoutes.js`, `user.routes.ts`, `router.js` |
| 🎮 Controller | `controllers/`, `controladores/`, `UsuarioController.java`, `controllerUsuario.js` |
| ⚙️ Service | `services/`, `usuarioService.js`, `servicoEmail.js` |
| 📦 Repository | `repositories/`, `UsuarioRepository.ts`, `usuarioDAO.java` |
| 🗃️ Model | `models/`, `modelos/`, `entities/`, `schemas/`, `Modelusuario.js` |
| 🛢️ Banco de dados | `db.js`, `config/db.js`, `database/`, `conexao.js`, `dbConnection.js`, `migrations/` |
| 🚧 Middleware | `middlewares/`, `authMiddleware.js` |
| 🖥️ View (tela) | `views/`, `pages/`, `components/`, `public/` |
| Outras | Validação, Configuração, Utilitário, Teste e Servidor (`server.js`, `app.js`) |

Com isso, o hover e a explicação mostram em qual camada o erro está, o que essa camada faz e uma dica do erro comum nela (ex.: no controller, "resposta enviada duas vezes"; no model, "a consulta não encontrou nada"; em qualquer camada, "o banco não está rodando" para `ECONNREFUSED`). Nos erros do terminal aparece também o **caminho do erro**: `🛣️ Rota → 🎮 Controller → 🗃️ Model`. Para desligar: `tradutorErros.mostrarCamada`.

Copie o erro **inteiro**, com as linhas `at ...` (JavaScript) ou `File "..."` (Python): é por elas que a extensão descobre o arquivo e a linha. Exemplo: em `TypeError: Cannot read properties of undefined (reading 'map')`, a extensão abre o arquivo e mostra que quem está `undefined` é `dados.itens`, e não o `map`.

## Como traduz

1. Primeiro procura num **dicionário embutido** com as mensagens mais comuns, com explicações pensadas para quem está começando. Funciona offline.
2. Se a mensagem não estiver no dicionário, usa a **tradução automática** do Google Tradutor. Só o texto da mensagem de erro é enviado. Para desligar, desative `tradutorErros.traducaoOnline`.

## Configurações

| Configuração | Padrão | Descrição |
|---|---|---|
| `tradutorErros.ativado` | `true` | Liga/desliga a extensão |
| `tradutorErros.mostrarNaLinha` | `true` | Tradução no fim da linha |
| `tradutorErros.severidadeNaLinha` | `aviso` | `erro`, `aviso`, `informacao` ou `dica` |
| `tradutorErros.traducaoOnline` | `true` | Usa o Google Tradutor quando a mensagem não está no dicionário |
| `tradutorErros.mostrarVocabulario` | `true` | Mostra o vocabulário no hover |
| `tradutorErros.analisarCausa` | `true` | Em JS/TS, mostra a causa provável e o local exato do erro |
| `tradutorErros.mostrarReferencia` | `true` | Em JS/TS, mostra a explicação (MDN) de palavras-chave e funções prontas |
| `tradutorErros.linksNoTerminal` | `true` | Transforma as mensagens de erro do terminal em links para a explicação |
| `tradutorErros.mostrarCamada` | `true` | Identifica a camada (Model, Controller, Rota, Banco...) pelo nome do arquivo/pasta e mostra dicas dela |

## Comandos

- *Tradutor de Erros: Traduzir erro copiado*
- *Tradutor de Erros: Traduzir erro selecionado* (menu do botão direito no terminal)
- *Tradutor de Erros: Listar erros do arquivo traduzidos*
- *Tradutor de Erros: Mostrar/ocultar tradução no fim da linha*
- *Tradutor de Erros: Limpar cache de traduções*

## Contribuir

Achou uma mensagem sem tradução ou com tradução ruim? Abra uma [issue](https://github.com/higorsdds-bot/Erros-traduzidos_PTBR/issues) ou adicione uma regra na lista `regras` em `tradutor.js`. Para testar: `node teste-dicionario.js` (dicionário), `node teste-analisador.js` (causa real dos erros de JS) , `node teste-erro-colado.js` (erros colados do terminal) , `node teste-projetos.js` (projetos com server/routes/controllers/models) e `node teste-camadas.js` (camada pelo nome do arquivo/pasta).

Para gerar e instalar localmente:

```
npx @vscode/vsce package
code --install-extension tradutor-de-erros-0.1.2.vsix
```

## Licença

MIT
