# Tradutor de Erros (PT-BR)

Mostra os erros e sugestões do editor **em inglês e em português**, para você aprender a programar sem travar no inglês — e aprender o inglês técnico ao mesmo tempo.

Funciona no **VS Code**, no **Antigravity**, no **Cursor** e em outros editores baseados no VS Code, com qualquer linguagem que mostre erros no editor: JavaScript, TypeScript, Python, Java, PHP, C#...

## O que faz

**Hover com tradução**: ao passar o mouse sobre um erro, aparece:

> 🔴 **Erro** (ts)
>
> 🇺🇸 `';' expected.`
>
> 🇧🇷 **Era esperado ';' aqui (está faltando ';').**
>
> 📚 **Vocabulário:** `expected` = esperado

**Tradução no fim da linha**: a tradução aparece em itálico ao lado da linha com erro, na cor do erro.

**Lista completa**: `Ctrl+Shift+P` → *Tradutor de Erros: Listar erros do arquivo traduzidos*.

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

## Comandos

- *Tradutor de Erros: Listar erros do arquivo traduzidos*
- *Tradutor de Erros: Mostrar/ocultar tradução no fim da linha*
- *Tradutor de Erros: Limpar cache de traduções*

## Contribuir

Achou uma mensagem sem tradução ou com tradução ruim? Abra uma [issue](https://github.com/higorsdds-bot/Erros-traduzidos_PTBR/issues) ou adicione uma regra na lista `regras` em `tradutor.js`. Para testar o dicionário: `node teste-dicionario.js`.

Para gerar e instalar localmente:

```
npx @vscode/vsce package
code --install-extension tradutor-de-erros-0.1.0.vsix
```

## Licença

MIT
