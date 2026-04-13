# Plano do Modulo Financeiro do XJUR

## Missao do Modulo

`Financeiro` e o motor economico-operacional do XJUR.

Ele existe para registrar, prever, cobrar, receber, liquidar, conciliar e explicar o dinheiro do escritorio, conectando receitas, despesas, partes, processos, contas bancarias, cobranca e contexto fiscal.

## Papel Estrategico

Sem um modulo financeiro forte:

- o escritorio nao sabe o que tem a receber
- o controle de custos e honorarios fica difuso
- o processo perde lastro economico
- a cobranca vira improviso
- a conciliacao bancaria fica manual e fraca
- o fiscal emite sem base confiavel

Por isso, `Financeiro` nao e apenas contas a pagar e receber.
Ele e a camada que transforma eventos operacionais em previsao, controle e baixa real.

## Centro do Dominio

O centro do dominio e o registro `FinancialRecord`, apoiado por estruturas que refinam partes, rateios, categorias e contas bancarias.

### Estruturas centrais atuais

- `FinancialRecord`
- `FinancialParty`
- `TransactionSplit`
- `FinancialCategory`
- `BankAccount`
- `BankIntegration`
- `BankTransaction`

## Verdades do Modulo

### 1. Lancamento financeiro e a unidade central

Tudo gira em torno do registro financeiro:

- valor
- vencimento
- status
- tipo
- partes
- conta
- origem

### 2. O financeiro precisa refletir realidade e previsao

Ele deve suportar:

- pendencia
- parcial
- quitacao
- residual
- parcelamento
- cobranca programada

### 3. Parte financeira nao e a mesma coisa que contato generico

O contato pode aparecer no financeiro, mas o papel financeiro precisa ser explicito: devedor, credor, cliente, contraparte, beneficiario.

### 4. Conta bancaria nao e o financeiro inteiro

Banco e meio operacional do dinheiro.
Nao deve dominar o desenho do modulo.

### 5. Fiscal depende do financeiro, mas nao se confunde com ele

Documento fiscal nasce apoiado no financeiro, mas a regra fiscal continua em seu proprio dominio.

## Problemas que o Modulo Deve Resolver

1. Controlar receitas e despesas com clareza
2. Suportar parcelamento, parcial e residual
3. Relacionar dinheiro com processo, contato e origem
4. Permitir cobranca e liquidacao confiaveis
5. Integrar banco, conciliacao e documentos fiscais sem perder disciplina

## Escopo Nucleo

O nucleo do modulo deve conter:

- contas a pagar e receber
- categorias financeiras
- partes financeiras
- rateio
- parcelamento
- liquidacao
- dashboard e visao gerencial
- contas bancarias
- cobranca automatizada

## Escopo que Nao Deve Virar Bagunca

O modulo nao deve virar:

- ERP fiscal completo
- CRM de negociacao comercial
- modulo bancario autonomo sem relacao com os lancamentos
- inbox de cobranca
- deposito de regras de negocio de outros modulos

Ele pode centralizar o efeito financeiro dos dominios, mas nao deve absorver tudo.

## Regras Mestras do Modulo

### 1. FinancialRecord e a verdade contabil-operacional

Tudo deve convergir para um registro financeiro claro e auditavel.

### 2. Status precisam refletir realidade

`PENDING`, `PARTIAL`, `PAID`, `OVERDUE`, `CANCELLED` e derivados devem representar estados reais, nao atalhos de interface.

### 3. Liquidacao precisa ser rastreavel

Toda baixa precisa deixar claro:

- quando ocorreu
- quanto foi pago
- por qual meio
- em qual conta
- com quais encargos ou descontos

### 4. Banco e camada operacional

Contas, integracoes e transacoes bancarias apoiam o financeiro, mas nao substituem o registro financeiro central.

### 5. Fiscal e camada especializada

O financeiro prepara e sustenta a emissao, mas nao deve carregar regras fiscais profundas dentro do seu proprio dominio.

## Fluxos Obrigatorios

1. criar lancamento financeiro
2. localizar por status, tipo, data, categoria e processo
3. parcelar
4. registrar pagamento parcial
5. liquidar com encargos e anexos
6. criar e ajustar rateios
7. vincular partes
8. gerenciar contas bancarias
9. disparar regua de cobranca
10. suportar conciliacao e integracao bancaria

## Riscos Atuais do Dominio

1. tela unica muito grande e com muitos subdominios
2. mistura entre financeiro, bancario e fiscal
3. crescimento do Banking Hub sem fronteira forte
4. risco de excesso de regras de UI em vez de regras de dominio
5. cobranca, conciliacao e emissao ainda precisando de consolidacao arquitetural

## Direcao de Evolucao

### Fase 1. Fortalecer o lancamento central

- reforcar `FinancialRecord` como verdade
- simplificar regras de criacao e atualizacao
- deixar mais claro o papel de partes, parcelas e residual

### Fase 2. Separar melhor os subdominios

- financeiro central
- bancario operacional
- fiscal especializado

### Fase 3. Melhorar cobranca e baixa

- regua de cobranca
- agendamentos de mensagens
- baixa por comprovante
- liquidacao mais rastreavel

### Fase 4. Consolidar conciliacao

- transacao bancaria
- sugestao de match
- reconciliacao assistida
- reflexo no lancamento financeiro

### Fase 5. Integrar com o restante do XJUR

- contatos
- processos
- atendimento
- fiscal
- IA

## Perguntas que Sempre Devem Ser Feitas Antes de Evoluir o Modulo

1. esta mudanca melhora o controle real do dinheiro
2. isso pertence ao financeiro central, ao bancario ou ao fiscal
3. o `FinancialRecord` continua sendo a verdade
4. a operacao ficou mais auditavel ou mais confusa
5. essa regra melhora previsao, cobranca, baixa ou conciliacao

## Entregavel Esperado da Nova Fase

Ao final da revisao, o modulo `Financeiro` deve estar claramente definido como:

- motor economico-operacional do XJUR
- centro confiavel de receitas e despesas
- base de cobranca, liquidacao e conciliacao
- integrador disciplinado de banco e fiscal

## Arquivos de Referencia do Codigo Atual

- [schema.prisma](C:\.Sistemas\Xjur\packages\database\prisma\schema.prisma:595)
- [financial.service.ts](C:\.Sistemas\Xjur\apps\api\src\financial\financial.service.ts:344)
- [Financial.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\Financial.tsx:641)
