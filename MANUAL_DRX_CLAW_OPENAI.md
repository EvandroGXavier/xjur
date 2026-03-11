# Manual Inicial do DrX-Claw via OpenAI

## Objetivo

Este manual orienta a configuracao inicial do painel `DrX-Claw` para uma empresa, usando a OpenAI como provider principal, e explica como fazer os primeiros testes no Playground.

---

## Onde configurar

1. Acesse `Configuracoes`.
2. Clique na aba `DrX-Claw`.
3. O painel sera carregado com a configuracao da empresa logada.

---

## Configuracao minima recomendada

Preencha os campos abaixo no bloco `Setup principal`:

- `Nome do assistente`
  - Exemplo: `DrX-Claw`
- `Empresa vinculada`
  - Exemplo: `Dr.X Matriz`
- `Provider principal`
  - Selecione `OpenAI`
- `Max iterations`
  - Recomendado: `5` ou `6`
- `DrX-Claw habilitado para esta empresa`
  - Marque como ativo
- `Whitelist Telegram (IDs)`
  - Informe os IDs que podem testar o agente
  - Exemplo: `12345678, 87654321`
- `Prompt-base do agente`
  - Recomendacao inicial:

```text
Voce e o DrX-Claw da empresa. Responda em portugues do Brasil com clareza, contexto do negocio, proximos passos acionaveis e tom profissional.
Se houver cobranca, seja objetivo e respeitoso.
Se houver triagem, identifique urgencia, documentos faltantes e qual setor deve assumir.
```

---

## Configuracao OpenAI

No bloco `Providers e credenciais`:

1. Preencha `API OpenAI` com a chave da empresa.
2. Mantenha o provider principal como `OpenAI`.
3. Se quiser usar um modelo compativel com o painel, deixe o modelo em `OpenAI Compatible` como referencia operacional.

Observacao:

- O backend atual executa o fluxo OpenAI pelo endpoint padrao de chat completions.
- Se a chave estiver vazia ou invalida, o Playground entra em `modo assistido`, o que ainda permite validar skills, contexto e roteamento.

---

## Skills iniciais

No bloco `Skills operacionais`, recomendamos iniciar com pelo menos estas 3:

1. `Atendimento Inicial`
   - Para triagem e qualificacao
2. `Cobranca Inteligente`
   - Para financeiro, vencimentos e negociacao
3. `Agenda e Retorno`
   - Para follow-up e proximos passos

Voce pode:

- ativar ou desativar skills
- incluir skills novas manualmente
- remover skills antigas

Para uma nova skill, preencha:

- `Nome`
- `Descricao`
- `Instrucoes`
- `Palavras-chave`

Exemplo:

- Nome: `Contratos`
- Descricao: `Ajuda a responder duvidas contratuais`
- Instrucoes: `Resuma a demanda, identifique risco e proponha proximo passo`
- Palavras-chave: `contrato, clausula, revisao, multa`

---

## Primeiro teste no Playground

No bloco `Playground do Admin`:

1. Escolha um preset ou escreva um prompt manual.
2. Defina o `Cenario de teste`.
3. Ajuste:
   - `Temperatura`: recomendado `0.3` a `0.5`
   - `Max tokens`: recomendado `500` a `800`
4. Clique em `Executar playground`.

Exemplo de teste inicial:

```text
Monte uma resposta para uma cobranca amigavel de parcela vencida nesta semana.
```

Resultado esperado:

- o painel identifica skills relacionadas
- o contexto efetivo do teste pode ser inspecionado
- a resposta aparece no card `Resposta do playground`

Se a chave OpenAI ainda nao estiver configurada:

- o sistema devolve uma `previa assistida`
- isso permite validar prompt-base, skill acionada e formato de resposta antes do teste ao vivo

---

## Fluxo recomendado de implantacao

1. Salvar a configuracao base do DrX-Claw.
2. Ativar somente 2 ou 3 skills no inicio.
3. Testar no Playground com 5 a 10 cenarios reais.
4. Ajustar o prompt-base.
5. Ajustar palavras-chave das skills.
6. Somente depois liberar testes externos via Telegram whitelist.

---

## Checklist de go-live

- Provider definido como `OpenAI`
- API key preenchida
- Empresa vinculada preenchida
- Prompt-base revisado
- Whitelist Telegram configurada
- Pelo menos 1 skill ativa
- Playground validado com cenarios reais

---

## Solucao de problemas

### O Playground nao responde ao vivo

Verifique:

- se a `API OpenAI` foi preenchida
- se a chave e valida
- se a internet do servidor esta ativa

### Nenhuma skill foi acionada

Revise:

- palavras-chave da skill
- descricao da skill
- texto do prompt de teste

### O agente responde de forma generica

Melhore:

- o `Prompt-base do agente`
- as `Instrucoes` da skill
- o cenario do Playground

---

## Observacao operacional

O painel do DrX-Claw foi pensado para o proprio admin configurar, testar e evoluir o agente sem depender de deploy para cada ajuste fino de comportamento.
