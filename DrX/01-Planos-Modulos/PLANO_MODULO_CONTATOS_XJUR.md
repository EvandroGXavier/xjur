# Plano do Modulo Contatos do XJUR

## Missao do Modulo

`Contatos` e a entidade ancora do XJUR.

Ele existe para garantir que uma pessoa ou empresa seja reconhecida como a mesma entidade em todo o sistema, independentemente de entrar por atendimento, processo, financeiro, fiscal, agenda ou documentos.

## Papel Estrategico

Sem um modulo de contatos forte:

- o atendimento duplica pessoas
- o processo perde o vinculo correto das partes
- o financeiro cobra a pessoa errada
- o fiscal emite para dados inconsistentes
- a IA perde contexto

Por isso, `Contatos` nao deve ser tratado como cadastro auxiliar.
Ele e base-mestre do produto.

## Centro do Dominio

O centro do dominio e o registro `Contact`, apoiado por subestruturas que refinam identidade, relacionamento e contexto.

### Estruturas centrais atuais

- `Contact`
- `ContactChannelIdentity`
- `ContactRelation`
- `ContactAsset`
- `Address`
- `AdditionalContact`

## Verdades do Modulo

### 1. Identidade

Um contato precisa representar uma identidade unica e rastreavel.

Isso inclui:

- nome principal
- tipo de pessoa
- documento
- canais de contato
- aliases de canais
- vinculos com PF e PJ

### 2. Multicanal

O contato deve ser a mesma entidade em:

- WhatsApp
- telefone
- email
- documentos
- processo
- financeiro

### 3. Relacional

Contato nao e uma ficha isolada.
Ele precisa suportar:

- vinculos entre pessoas e empresas
- papeis juridicos
- patrimonio
- contratos
- historico financeiro

### 4. Contextual

O contato precisa ser reutilizavel em todos os modulos sem perder coerencia.

## Problemas que o Modulo Deve Resolver

1. Evitar duplicidade de pessoas e empresas
2. Unificar todos os canais da mesma entidade
3. Servir como base para processos, atendimento e financeiro
4. Permitir enriquecimento e cadastro progressivo
5. Suportar vinculos juridicos, comerciais e operacionais

## Escopo Nucleo

O nucleo do modulo deve conter:

- cadastro unificado PF, PJ e lead
- identidade por documento e canal
- enderecos e contatos adicionais
- vinculos entre contatos
- patrimonio
- contratos vinculados ao contato
- visao financeira relacionada

## Escopo que Nao Deve Virar Bagunca

O modulo nao deve virar:

- inbox de mensagens
- modulo bancario
- gestor fiscal
- motor de workflow
- deposito de configuracoes que pertencem a outros modulos

Ele pode exibir contexto desses dominos, mas nao deve se tornar dono deles.

## Regras Mestras do Modulo

### 1. Uma entidade, varios contextos

O contato e unico, mesmo que apareca em varios modulos.

### 2. Canais sao identidades auxiliares

WhatsApp, email e telefone nao sao o contato.
Eles sao caminhos de identificacao do contato.

### 3. Documento nao basta sozinho

CPF ou CNPJ ajudam, mas o sistema tambem precisa tratar:

- lead sem documento
- canal sem documento
- empresa e representante
- aliases historicos

### 4. O contato nao deve concentrar segredos de outros dominios

Credenciais bancarias, fiscais ou operacionais nao pertencem ao contato, a menos que sejam realmente segredo do proprio contato.

### 5. O modulo deve aceitar amadurecimento progressivo

Um lead pode nascer com pouco dado e amadurecer depois para PF ou PJ, sem perder historico.

## Fluxos Obrigatorios

1. criar contato manual
2. localizar contato por canal ou documento
3. enriquecer PF ou PJ
4. vincular contato a processo
5. vincular contato a atendimento
6. vincular contato a financeiro
7. manter relacoes, patrimonio e contratos
8. evitar ou corrigir duplicidade

## Riscos Atuais do Dominio

1. crescimento excessivo da tela de contato
2. mistura de responsabilidades de outros modulos
3. duplicidade por canal e por cadastro parcial
4. excesso de campos na mesma experiencia
5. regras de identidade ainda pouco centralizadas

## Direcao de Evolucao

### Fase 1. Fortalecer a identidade

- consolidar regras de deduplicacao
- centralizar busca exata por canal e documento
- reforcar `ContactChannelIdentity` como base de omnichannel

### Fase 2. Separar fronteiras

- manter no contato apenas o que pertence ao contato
- mover integracoes tecnicas para seus dominios corretos
- deixar o contato como ancora e nao como deposito

### Fase 3. Melhorar a experiencia

- simplificar a leitura do formulario
- reforcar a logica por abas
- destacar o que e cadastro base e o que e contexto relacionado

### Fase 4. Integrar com o restante do XJUR

- atendimento
- processos
- financeiro
- fiscal
- IA

## Perguntas que Sempre Devem Ser Feitas Antes de Evoluir o Modulo

1. esta mudanca melhora a identidade unica do contato
2. esta mudanca pertence mesmo a contatos ou a outro modulo
3. isso aumenta ou reduz duplicidade
4. isso melhora a reutilizacao do contato no sistema inteiro
5. essa nova informacao e estrutural ou apenas contextual

## Entregavel Esperado da Nova Fase

Ao final da revisao, o modulo `Contatos` deve estar claramente definido como:

- base mestre de pessoas e empresas
- ancora de identidade multicanal
- hub relacional do sistema
- ponto de integracao sem invasao de dominio

## Arquivos de Referencia do Codigo Atual

- [schema.prisma](C:\.Sistemas\Xjur\packages\database\prisma\schema.prisma:162)
- [contacts.service.ts](C:\.Sistemas\Xjur\apps\api\src\contacts\contacts.service.ts:227)
- [ContactForm.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\contacts\ContactForm.tsx:346)
