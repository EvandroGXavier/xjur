# Plano do Modulo Processos do XJUR

## Missao do Modulo

`Processos` e a espinha dorsal juridica do XJUR.

Ele existe para transformar um caso juridico em uma estrutura viva, rastreavel e operacional, conectando capa, partes, andamentos, documentos, agenda, financeiro e inteligencia assistida.

## Papel Estrategico

Sem um modulo de processos forte:

- o escritorio perde contexto juridico
- o atendimento nao sabe em qual caso a conversa pertence
- a agenda fica solta
- o financeiro perde relacao com honorarios, custas e recebimentos
- a documentacao perde lastro
- a IA nao consegue resumir ou orientar com seguranca

Por isso, `Processos` nao e apenas um cadastro de CNJ.
Ele e o centro juridico-operacional do produto.

## Centro do Dominio

O centro do dominio e o registro `Process`, apoiado por estruturas que descrevem partes, movimentos, responsabilidades e contexto operacional.

### Estruturas centrais atuais

- `Process`
- `ProcessParty`
- `ProcessPartyRepresentation`
- `ProcessTimeline`
- `PartyRole`
- `PartyQualification`

## Verdades do Modulo

### 1. O processo e um caso vivo

O processo nao e so identificacao.
Ele precisa refletir:

- estado atual
- historico
- partes e polos
- prazos
- documentos
- vinculos financeiros

### 2. Partes sao centrais

O cliente nao deve ficar escondido em um campo isolado.
As partes devem ser a verdade da relacao entre processo e contatos.

### 3. Timeline e a memoria operacional

Os andamentos precisam registrar:

- origem
- data
- efeito pratico
- prioridade
- acao interna

### 4. O processo integra, mas nao absorve tudo

O modulo precisa conversar com atendimento, agenda, documentos, financeiro e IA, mas sem virar dono dos dominios alheios.

## Problemas que o Modulo Deve Resolver

1. Organizar juridicamente o caso
2. Consolidar partes, polos e representantes
3. Registrar andamentos internos e externos
4. Servir de base para documentos, agenda e financeiro
5. Permitir importacao segura de informacoes por CNJ, PDF e integracoes

## Escopo Nucleo

O nucleo do modulo deve conter:

- capa do processo
- partes e representacoes
- timeline
- documentos vinculados
- agenda vinculada
- contexto financeiro vinculado
- integracoes juridicas e importacoes

## Escopo que Nao Deve Virar Bagunca

O modulo nao deve virar:

- CRM de contato
- caixa de mensagens
- modulo financeiro completo
- GED independente de processo
- deposito de configuracoes tecnicas sem relacao juridica

Ele pode centralizar contexto do caso, mas nao deve engolir os demais modulos.

## Regras Mestras do Modulo

### 1. Processo e unidade juridica

Tudo o que entra no processo deve melhorar a compreensao ou a operacao do caso.

### 2. Parte substitui atalho de cliente unico

A relacao com pessoas e empresas deve ser feita por `ProcessParty`, e nao por atalhos que enfraquecem o modelo.

### 3. Timeline precisa ser confiavel

Cada movimento deve ter origem clara:

- tribunal
- PDF
- usuario
- sistema
- IA

### 4. Integracao externa nao pode contaminar o dominio

CNJ, PDF, DataJud e outros conectores ajudam a alimentar o processo, mas nao devem deformar sua estrutura interna.

### 5. Documento processual e contexto, nao caos

Documentos, resumos e importacoes devem fortalecer a leitura do caso, nao criar mais ruido.

## Fluxos Obrigatorios

1. criar processo manualmente
2. localizar processo por CNJ, codigo ou titulo
3. cadastrar e manter partes
4. importar dados por PDF
5. importar andamentos oficiais por CNJ
6. registrar timeline interna
7. vincular documentos
8. vincular agenda
9. vincular financeiro
10. consumir IA de apoio sem perder rastreabilidade

## Riscos Atuais do Dominio

1. crescimento excessivo do formulario de processo
2. mistura entre cadastro, importacao e operacao
3. sobrecarga da timeline com sinais de origem diferentes
4. risco de duplicidade ou conflito entre importacao por CNJ e por PDF
5. acoplamento crescente com modulos de suporte

## Direcao de Evolucao

### Fase 1. Fortalecer a capa juridica

- deixar a capa mais clara
- reforcar status, categoria e identificadores
- consolidar regras do que e essencial no processo

### Fase 2. Fortalecer partes como verdade do vinculo

- remover dependencias de atalhos antigos
- centralizar cliente, contraparte, advogado e representante em `ProcessParty`
- melhorar consistencia de papeis e qualificacoes

### Fase 3. Reorganizar a timeline

- diferenciar melhor fontes internas e externas
- reforcar utilidade operacional
- melhorar leitura de prazos, prioridades e proximos passos

### Fase 4. Tratar importacao como pipeline

- capa por PDF
- processo integral por PDF
- andamentos por CNJ
- evitar conflitos entre fontes

### Fase 5. Integrar com o restante do XJUR

- contatos
- atendimento
- agenda
- documentos
- financeiro
- IA

## Perguntas que Sempre Devem Ser Feitas Antes de Evoluir o Modulo

1. esta mudanca melhora a operacao juridica do caso
2. isso pertence ao processo ou a outro modulo
3. a verdade do dado esta na capa, nas partes ou na timeline
4. essa integracao esta alimentando o processo ou deformando o dominio
5. isso deixa o caso mais claro ou mais pesado

## Entregavel Esperado da Nova Fase

Ao final da revisao, o modulo `Processos` deve estar claramente definido como:

- centro juridico-operacional do XJUR
- unidade viva do caso
- integrador de partes, timeline e contexto
- consumidor disciplinado de importacoes e IA

## Arquivos de Referencia do Codigo Atual

- [schema.prisma](C:\.Sistemas\Xjur\packages\database\prisma\schema.prisma:403)
- [processes.service.ts](C:\.Sistemas\Xjur\apps\api\src\processes\processes.service.ts:2187)
- [ProcessForm.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\processes\ProcessForm.tsx:879)
