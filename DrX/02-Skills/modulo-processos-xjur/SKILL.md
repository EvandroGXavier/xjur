---
name: modulo-processos-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir o modulo Processos do XJUR como centro juridico-operacional, integrando partes, timeline, documentos, agenda, financeiro e importacoes com disciplina de dominio.
---

# Skill do Modulo Processos do XJUR

Use esta skill sempre que o pedido envolver:

- revisar o modulo de processos
- ajustar capa, partes, timeline ou status do processo
- importar ou consolidar dados por CNJ, PDF ou integracoes
- redefinir a fronteira entre processo e outros modulos
- revisar fluxo juridico-operacional do caso
- planejar evolucao do modulo juridico

## Missao

Garantir que `Processos` continue sendo o centro juridico-operacional do XJUR, e nao um modulo inflado por configuracoes, atalhos e responsabilidades desalinhadas.

## Leitura Minima Obrigatoria

Leia primeiro:

- [PLANO_MODULO_PROCESSOS_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_PROCESSOS_XJUR.md)
- [schema.prisma](C:\.Sistemas\Xjur\packages\database\prisma\schema.prisma:403)
- [processes.service.ts](C:\.Sistemas\Xjur\apps\api\src\processes\processes.service.ts:2187)
- [ProcessForm.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\processes\ProcessForm.tsx:879)

Quando a tarefa envolver UX ou CRUD, leia tambem:

- [SKILL.md](C:\.Sistemas\Xjur\.agent\skills\drx-crud-builder\SKILL.md)

Quando a tarefa envolver arquitetura ou fronteira entre modulos, leia tambem:

- [PLANO_REINICIO_XJUR.md](C:\.Sistemas\Xjur\PLANO_REINICIO_XJUR.md)
- [MAPA_MODULOS_XJUR.md](C:\.Sistemas\Xjur\MAPA_MODULOS_XJUR.md)

## Principios Obrigatorios

### 1. Processo e unidade juridica viva

O processo deve refletir a realidade operacional do caso, nao apenas um cadastro.

### 2. Partes sao a verdade relacional

Cliente, contraparte, advogado e representantes devem ser tratados por `ProcessParty` e estruturas derivadas.

### 3. Timeline e memoria de decisao e acao

Toda movimentacao precisa ter origem, impacto e utilidade operacional.

### 4. Integracoes alimentam o processo, nao o controlam

PDF, CNJ, DataJud e conectores externos servem ao modulo, mas nao devem deformar seu modelo interno.

### 5. Processo nao deve absorver modulos inteiros

Atendimento, documentos, agenda e financeiro devem se vincular ao processo sem perder seus proprios centros de dominio.

## Perguntas de Decisao

Antes de implementar qualquer mudanca, responder:

1. qual problema juridico ou operacional do caso esta sendo resolvido
2. isso pertence ao processo ou a outro modulo
3. a verdade do dado esta na capa, nas partes, na timeline ou em modulo externo
4. essa mudanca melhora rastreabilidade ou adiciona confusao
5. qual impacto isso gera em importacao, leitura e operacao do caso

## Resultado Esperado

Toda entrega no modulo deve fortalecer pelo menos um destes pilares:

- clareza da capa juridica
- consistencia das partes
- utilidade real da timeline
- integracao disciplinada com outros modulos
- importacao mais segura e confiavel

## Workflow Recomendado

1. identificar a missao exata da mudanca
2. localizar se ela afeta capa, partes, timeline, importacao ou integracao
3. validar fronteira entre `Processos` e os demais modulos
4. revisar impacto juridico e operacional
5. ajustar backend
6. ajustar frontend
7. validar efeitos em contatos, documentos, agenda, financeiro e IA quando houver

## O que Esta Dentro do Dominio de Processos

- capa do processo
- partes e representacoes
- timeline juridica e operacional
- integracoes por CNJ
- leitura e importacao por PDF
- contexto documental do caso
- contexto de agenda do caso
- contexto financeiro vinculado ao caso

## O que Nao Deve Nascer em Processos

- cadastro mestre de contatos
- inbox de mensagens
- modulo financeiro completo
- GED generico de toda a empresa
- configuracoes tecnicas sem relacao com o caso juridico

## Sinais de Alerta

Pare e reavalie quando:

- a capa estiver recebendo campos que nao melhoram a leitura do caso
- a timeline estiver virando deposito de qualquer evento
- a importacao por PDF e a importacao por CNJ estiverem competindo em vez de se complementar
- o processo estiver virando dono de funcionalidades de outros modulos

## Regra de Ouro

Se houver duvida entre colocar algo em `Processos` ou em outro modulo, mantenha em `Processos` apenas o que ajuda a entender, operar, acompanhar ou integrar juridicamente o caso.
