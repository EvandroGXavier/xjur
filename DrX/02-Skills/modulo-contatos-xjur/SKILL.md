---
name: modulo-contatos-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir o modulo Contatos do XJUR como entidade ancora de identidade, relacionamento e contexto compartilhado entre atendimento, processos, financeiro e fiscal.
---

# Skill do Modulo Contatos do XJUR

Use esta skill sempre que o pedido envolver:

- revisar o modulo de contatos
- criar ou alterar fluxos do cadastro de contatos
- redefinir identidade PF, PJ ou lead
- tratar duplicidade de pessoas e empresas
- ajustar integracoes do contato com atendimento, processos ou financeiro
- avaliar se algo pertence ou nao ao dominio de contatos

## Missao

Garantir que `Contatos` continue sendo a base mestre de identidade do XJUR, e nao um modulo inflado por responsabilidades de outras areas.

## Leitura Minima Obrigatoria

Leia primeiro:

- [PLANO_MODULO_CONTATOS_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_CONTATOS_XJUR.md)
- [schema.prisma](C:\.Sistemas\Xjur\packages\database\prisma\schema.prisma:162)
- [contacts.service.ts](C:\.Sistemas\Xjur\apps\api\src\contacts\contacts.service.ts:227)
- [ContactForm.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\contacts\ContactForm.tsx:346)

Quando a tarefa envolver UX ou CRUD, leia tambem:

- [SKILL.md](C:\.Sistemas\Xjur\.agent\skills\drx-crud-builder\SKILL.md)

Quando a tarefa envolver arquitetura ou fronteira entre modulos, leia tambem:

- [PLANO_REINICIO_XJUR.md](C:\.Sistemas\Xjur\PLANO_REINICIO_XJUR.md)
- [MAPA_MODULOS_XJUR.md](C:\.Sistemas\Xjur\MAPA_MODULOS_XJUR.md)

## Principios Obrigatorios

### 1. Contato e entidade ancora

Contato e a mesma pessoa ou empresa em todo o sistema.

### 2. Canais nao sao o contato

WhatsApp, telefone e email sao identidades auxiliares do contato.

### 3. Nao aceitar invasao de dominio

Se a mudanca pertence a banco, fiscal, atendimento ou processo, nao mover isso para dentro de `Contatos` sem justificativa forte.

### 4. Cadastro progressivo e permitido

Lead incompleto pode amadurecer para PF ou PJ sem perder historico.

### 5. Deduplicacao e prioridade permanente

Toda evolucao deve considerar risco de duplicidade por documento, telefone, WhatsApp, email ou alias.

## Perguntas de Decisao

Antes de implementar qualquer mudanca, responder:

1. qual problema de identidade esta sendo resolvido
2. isso pertence ao contato ou a outro modulo
3. isso reduz ou aumenta duplicidade
4. isso melhora a reutilizacao do contato em outros modulos
5. qual entidade sera a verdade do dado

## Resultado Esperado

Toda entrega no modulo deve fortalecer pelo menos um destes pilares:

- identidade unica
- relacao entre pessoas e empresas
- contexto compartilhado com outros modulos
- experiencia de cadastro e consulta
- consistencia multicanal

## Workflow Recomendado

1. identificar a missao exata da mudanca
2. localizar a entidade central afetada
3. validar fronteira entre `Contatos` e os demais modulos
4. revisar impacto em deduplicacao e busca
5. ajustar backend
6. ajustar frontend
7. validar efeitos em atendimento, processos e financeiro quando houver

## O que Esta Dentro do Dominio de Contatos

- cadastro PF, PJ e lead
- documentos de identidade
- canais e aliases
- enderecos
- contatos adicionais
- vinculos entre contatos
- patrimonio
- contratos ligados ao contato
- visao de historico financeiro relacionado

## O que Nao Deve Nascer em Contatos

- integracao bancaria da conta
- configuracao fiscal do tenant
- logica central de atendimento
- motor de mensagens
- workflow operacional de outros modulos

## Sinais de Alerta

Pare e reavalie quando:

- a tela de contato estiver recebendo configuracoes tecnicas de outro dominio
- a mudanca exigir muitos campos sem melhorar identidade
- a mesma pessoa puder nascer em dois lugares diferentes sem reconciliacao
- o contato virar dependencia obrigatoria para fluxos que nao precisam dele

## Regra de Ouro

Se houver duvida entre colocar algo em `Contatos` ou em outro modulo, prefira deixar em `Contatos` apenas o que ajuda a identificar, relacionar ou contextualizar a pessoa/empresa.
