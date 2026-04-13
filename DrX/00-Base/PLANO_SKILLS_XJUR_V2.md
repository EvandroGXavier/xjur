# Plano Base de Skills do XJUR

## Objetivo

Definir uma arquitetura simples para as skills do projeto, evitando proliferacao desordenada.

Skill nao deve ser um prompt solto.
Skill deve ser uma unidade de comportamento especializada.

## Regras Gerais

- cada skill deve ter um dominio principal
- cada skill deve resolver um tipo claro de problema
- cada skill deve ter entradas e saidas previsiveis
- cada skill deve saber o que nao pode fazer
- skills de sistema devem ser estaveis
- skills por tenant devem ser configuraveis

## Grupos de Skills

### 1. Skills de Atendimento

- triagem inicial
- qualificacao de lead
- classificacao de urgencia
- organizacao de conversa
- follow-up de atendimento

### 2. Skills Juridicas

- leitura de processo
- resumo juridico
- organizacao de partes e polos
- deteccao de prazo e pendencia
- apoio a estrategia inicial

### 3. Skills Financeiras

- cobranca
- negociacao
- leitura de comprovante
- sugerir baixa
- apoio a conciliacao

### 4. Skills Documentais

- leitura de PDF
- estruturacao de documento
- resumo operacional
- apoio a templates

### 5. Skills Operacionais

- agenda e follow-up
- classificacao de tarefas
- copiloto interno do escritorio

### 6. Skills Administrativas

- suporte de configuracao
- onboarding de tenant
- governanca de dados

## Estrutura Minima de Cada Skill

- nome
- tipo: `SYSTEM` ou `TENANT`
- modulo principal
- missao
- quando usar
- quando nao usar
- entradas aceitas
- saida esperada
- regras obrigatorias

## Ordem Recomendada de Criacao

1. skill de triagem de atendimento
2. skill de leitura juridica de processo
3. skill de cobranca e financeiro
4. skill de agenda e follow-up
5. skill de copiloto interno operacional

## Regra de Governanca

Antes de criar uma nova skill, validar:

1. se ela tem um dominio proprio
2. se nao duplica outra skill
3. se o modulo realmente precisa dela
4. se a saida dela sera usada por alguem ou por algum fluxo

## Papel Deste Documento

Este arquivo nao detalha as skills finais.
Ele define a disciplina de criacao das skills para a nova fase do XJUR.
