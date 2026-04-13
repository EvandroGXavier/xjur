---
name: modulo-atendimento-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir o modulo Atendimento do XJUR como centro resiliente de entrada, historico, ticket e operacao omnichannel.
---

# Skill do Modulo Atendimento do XJUR

Use esta skill sempre que o pedido envolver:

- inbox
- mensagens
- ticket
- WhatsApp
- omnichannel
- auditoria de atendimento
- continuidade de conversa

## Missao

Garantir que `Atendimento` preserve mensagens, contexto e continuidade, sem confundir canal, contato, ticket e conversa visual.

## Leitura Minima Obrigatoria

- [PLANO_MODULO_ATENDIMENTO_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_ATENDIMENTO_XJUR.md)
- [whatsapp.service.ts](C:\.Sistemas\Xjur\apps\api\src\whatsapp\whatsapp.service.ts:822)
- [inbox.service.ts](C:\.Sistemas\Xjur\apps\api\src\inbox\inbox.service.ts:799)
- [tickets.service.ts](C:\.Sistemas\Xjur\apps\api\src\tickets\tickets.service.ts:266)
- [atendimento-v2.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\atendimento\atendimento-v2.tsx:352)

## Principios Obrigatorios

- mensagem primeiro, fluxo depois
- nunca perder inbound
- ticket e agrupador, nao verdade primaria
- identidade canonica por contato e canal
- tudo precisa ser auditavel

## Regra de Ouro

Se houver duvida entre modelar algo como mensagem, atendimento ou ticket, preserve a mensagem como verdade e trate o resto como organizacao de fluxo.
