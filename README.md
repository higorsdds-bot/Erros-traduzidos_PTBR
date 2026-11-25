# Tradutor de Erros (PT-BR)

Mostra os erros e sugestões do VS Code **em inglês e em português**, para facilitar o aprendizado.

## O que faz

- **Hover**: ao passar o mouse sobre um erro, aparece a mensagem original 🇺🇸, a tradução 🇧🇷 e um pequeno vocabulário com as palavras-chave em inglês.
- **No fim da linha**: a tradução aparece em itálico ao lado da linha com erro.
- **Lista completa**: comando `Tradutor de Erros: Listar erros do arquivo traduzidos` (Ctrl+Shift+P).

Funciona com qualquer linguagem que mostre erros no VS Code (JavaScript, TypeScript, Python, Java, PHP, C#...).

## Como traduz

1. Primeiro procura num **dicionário embutido** com as mensagens mais comuns (funciona offline e com explicações didáticas).
2. Se não encontrar, usa a **tradução automática** do Google Tradutor. Nesse caso, só o texto da mensagem de erro é enviado. Para desligar, desative `tradutorErros.traducaoOnline`.

Para adicionar novas mensagens ao dicionário, edite a lista `regras` em `tradutor.js`.

## Configurações

| Configuração | Padrão | Descrição |
|---|---|---|
| `tradutorErros.ativado` | `true` | Liga/desliga a extensão |
| `tradutorErros.mostrarNaLinha` | `true` | Tradução no fim da linha |
| `tradutorErros.severidadeNaLinha` | `aviso` | `erro`, `aviso`, `informacao` ou `dica` |
| `tradutorErros.traducaoOnline` | `true` | Usa o Google Tradutor quando a mensagem não está no dicionário |
| `tradutorErros.mostrarVocabulario` | `true` | Mostra o vocabulário no hover |

## Instalar / atualizar

```
git clone https://github.com/higorsdds-bot/Erros-traduzidos_PTBR.git
cd Erros-traduzidos_PTBR
npx @vscode/vsce package
code --install-extension tradutor-de-erros-0.1.0.vsix
```

Depois, recarregue o VS Code (Ctrl+Shift+P → "Developer: Reload Window").

Testar o dicionário: `node teste-dicionario.js`
