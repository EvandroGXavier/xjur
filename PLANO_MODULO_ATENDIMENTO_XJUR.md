# Plano do Modulo Atendimento do XJUR

## Missao do Modulo

`Atendimento` e a porta de entrada operacional do XJUR.

Ele existe para receber, organizar, responder, encaminhar e rastrear interacoes vindas de canais como WhatsApp, email e outros meios, preservando historico, contexto, resiliencia e continuidade.

## Papel Estrategico

Sem um modulo de atendimento forte:

- mensagens se perdem
- o contato se fragmenta
- tickets abrem de forma caotica
- a equipe perde contexto
- a IA trabalha sobre dados incompletos

Por isso, `Atendimento` nao e apenas uma tela de conversa.
Ele e o centro resiliente de entrada e operacao de mensagens.

## Centro do Dominio

O centro do dominio e a mensagem como verdade operacional, com atendimento e ticket como estruturas derivadas de fluxo.

### Estruturas centrais atuais

- `IncomingEvent`
- `TicketMessage`
- `AgentConversation`
- `AgentMessage`
- `Ticket`
- `Connection`

## Verdades do Modulo

- mensagem recebida nao pode se perder
- canal nao define o contato, apenas o caminho de entrada
- ticket e agrupador de fluxo, nao dono da mensagem
- atendimento aberto deve preservar continuidade
- auditoria e rastreabilidade sao obrigatorias

## Escopo Nucleo

- ingestao resiliente
- vinculacao com contato
- trilha de mensagens
- atendimento e ticket
- fila, status e responsavel
- envio e recebimento omnichannel
- auditoria

## Regras Mestras

- a mensagem e a verdade
- o canal entra por conexao, nao por improviso
- atendimento e ticket nao podem duplicar historico
- inbound e outbound precisam compartilhar identidade canonica
- auditoria deve expor ids e origem real

## Fluxos Obrigatorios

1. receber mensagem
2. persistir antes de processar
3. vincular ao contato
4. reaproveitar atendimento aberto
5. permitir resposta com rastreio
6. refletir status de entrega e leitura
7. manter historico auditavel

## Riscos Atuais

1. mistura entre inbox vivo e trilha definitiva
2. conflito entre id externo, jid, fullId e numero
3. abertura excessiva de atendimentos
4. acoplamento forte de UI com fluxo operacional

## Direcao de Evolucao

- consolidar mensagem como verdade definitiva
- deixar ticket como agrupador
- separar ingestao, processamento e exibicao
- reforcar continuidade por contato
- integrar IA sem quebrar a rastreabilidade

## Arquivos de Referencia do Codigo Atual

- [whatsapp.service.ts](C:\.Sistemas\Xjur\apps\api\src\whatsapp\whatsapp.service.ts:822)
- [inbox.service.ts](C:\.Sistemas\Xjur\apps\api\src\inbox\inbox.service.ts:799)
- [tickets.service.ts](C:\.Sistemas\Xjur\apps\api\src\tickets\tickets.service.ts:266)
- [atendimento-v2.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\atendimento\atendimento-v2.tsx:352)
