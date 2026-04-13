---
name: modulo-financeiro-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir o modulo Financeiro do XJUR como motor economico-operacional, preservando a centralidade do lancamento financeiro e separando corretamente os dominios bancario e fiscal.
---

# Skill do Modulo Financeiro do XJUR

Use esta skill sempre que o pedido envolver:

- revisar o modulo financeiro
- criar ou ajustar receitas, despesas, parcelas, residual, baixa ou rateio
- redefinir cobranca, conciliacao ou controle bancario
- analisar a fronteira entre financeiro, banco e fiscal
- revisar dashboard, categorias ou partes financeiras
- planejar evolucao do dominio financeiro

## Missao

Garantir que `Financeiro` continue sendo o motor economico-operacional do XJUR, e nao uma tela gigante onde tudo que envolve dinheiro foi sendo acumulado sem fronteira clara.

## Leitura Minima Obrigatoria

Leia primeiro:

- [PLANO_MODULO_FINANCEIRO_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_FINANCEIRO_XJUR.md)
- [schema.prisma](C:\.Sistemas\Xjur\packages\database\prisma\schema.prisma:595)
- [financial.service.ts](C:\.Sistemas\Xjur\apps\api\src\financial\financial.service.ts:344)
- [Financial.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\Financial.tsx:641)

Quando a tarefa envolver UX ou CRUD, leia tambem:

- [SKILL.md](C:\.Sistemas\Xjur\.agent\skills\drx-crud-builder\SKILL.md)

Quando a tarefa envolver arquitetura ou fronteira entre modulos, leia tambem:

- [PLANO_REINICIO_XJUR.md](C:\.Sistemas\Xjur\PLANO_REINICIO_XJUR.md)
- [MAPA_MODULOS_XJUR.md](C:\.Sistemas\Xjur\MAPA_MODULOS_XJUR.md)

## Principios Obrigatorios

### 1. FinancialRecord e a verdade

O registro financeiro deve continuar sendo o centro do dominio.

### 2. Status precisam refletir operacao real

Nao usar status apenas como conveniencia visual.
Eles devem representar o estado verdadeiro do lancamento.

### 3. Banco apoia, nao domina

Contas, integracoes e transacoes bancarias sao camadas operacionais do financeiro, nao seu substituto.

### 4. Fiscal e especializado

A emissao fiscal depende do financeiro, mas nao deve ser resolvida empilhando regras fiscais dentro do modulo financeiro.

### 5. Cobranca e liquidacao precisam ser auditaveis

Toda acao de cobranca, baixa, parcial ou residual deve deixar trilha clara.

## Perguntas de Decisao

Antes de implementar qualquer mudanca, responder:

1. qual problema financeiro real esta sendo resolvido
2. isso pertence ao financeiro central, ao bancario ou ao fiscal
3. o `FinancialRecord` continua sendo a verdade
4. isso melhora auditabilidade ou so adiciona interface
5. qual impacto isso gera em cobranca, baixa, dashboard e conciliacao

## Resultado Esperado

Toda entrega no modulo deve fortalecer pelo menos um destes pilares:

- clareza do lancamento
- previsao financeira
- liquidacao rastreavel
- cobranca organizada
- conciliacao disciplinada
- separacao correta entre financeiro, banco e fiscal

## Workflow Recomendado

1. identificar se a mudanca afeta lancamento, partes, rateio, cobranca, banco ou fiscal
2. localizar a entidade central afetada
3. validar a fronteira de dominio
4. revisar impacto em status, totalizacao e auditoria
5. ajustar backend
6. ajustar frontend
7. validar efeitos em processos, contatos, atendimento e fiscal quando houver

## O que Esta Dentro do Dominio de Financeiro

- receitas e despesas
- parcelas e residuais
- partes financeiras
- rateios
- categorias
- liquidacao
- cobranca
- dashboard financeiro
- contas bancarias
- contexto de conciliacao

## O que Nao Deve Nascer em Financeiro

- emissor fiscal completo
- CRM comercial generico
- inbox de atendimento
- configuracao tecnica de integracao sem ligacao com lancamento
- logica bancaria solta sem reflexo no registro financeiro

## Sinais de Alerta

Pare e reavalie quando:

- a tela estiver tentando resolver financeiro, banco e fiscal ao mesmo tempo sem separacao visivel
- uma transacao bancaria estiver virando verdade no lugar do `FinancialRecord`
- a cobranca estiver gerando mensagens sem amarracao clara ao dominio financeiro
- novas regras aumentarem a interface sem melhorar controle ou auditabilidade

## Regra de Ouro

Se houver duvida entre colocar algo no financeiro central, no bancario ou no fiscal, mantenha no `Financeiro` apenas o que ajuda a registrar, prever, cobrar, liquidar, conciliar ou explicar o dinheiro do escritorio.
