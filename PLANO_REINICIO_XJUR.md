# Plano de Reinicio do XJUR

## Objetivo

Reorganizar o XJUR como se estivesse sendo planejado do zero, sem apagar o sistema atual, para recuperar clareza de produto, arquitetura, prioridades e identidade operacional.

Este plano nao e um refactor imediato. Ele e a nova mesa central de decisao do projeto.

## Principio

Primeiro definimos a visao-mestre.
Depois revisamos cada modulo.
So entao priorizamos o que continua, o que muda, o que pausa e o que sai.

## Resultado Esperado

- uma visao unica do produto
- diretrizes arquiteturais estaveis
- criterios claros para cada modulo
- mapa de skills por dominio
- backlog mais limpo e coerente

## Ordem de Reconstrucao

### 1. Fundacao do Projeto

Responder de forma objetiva:

- qual problema central o XJUR resolve
- para quem ele existe
- quais sao os pilares obrigatorios do produto
- quais modulos sao nucleares e quais sao de apoio
- qual e o fluxo principal de uso do sistema

### 2. Diretrizes Mestras

Definir regras permanentes para:

- produto
- UX
- arquitetura
- multi-tenant
- integracoes
- seguranca
- persistencia
- automacoes
- IA e skills

### 3. Revisao Modulo a Modulo

Cada modulo deve passar por cinco perguntas:

1. Qual e a missao do modulo
2. Qual problema real ele resolve
3. O que e nucleo e o que e excesso
4. Quais entidades e fluxos sao a verdade do dominio
5. Qual deve ser a evolucao dele a partir de agora

### 4. Governanca de Skills

As skills deixam de ser acessorias e passam a ser parte da governanca operacional do projeto.

Cada skill deve ter:

- nome claro
- dominio unico
- objetivo pratico
- limites de atuacao
- entradas esperadas
- saidas esperadas
- regras e proibicoes

### 5. Novo Backlog

Depois da revisao:

- manter o que esta alinhado
- corrigir o que esta torto
- pausar o que ainda nao tem definicao madura
- remover o que so gera complexidade

## Entregaveis Minimos Deste Reinicio

- este plano central
- um mapa dos modulos
- um plano base de skills
- uma nova priorizacao de execucao

## Regra de Ouro

Nenhum modulo deve continuar crescendo sem:

- missao definida
- fronteiras claras
- entidades centrais corretas
- fluxo principal validado
- criterio de integracao com os demais modulos

## Proximo Passo Natural

Usar o arquivo [MAPA_MODULOS_XJUR.md](C:\.Sistemas\Xjur\MAPA_MODULOS_XJUR.md) como roteiro de revisao e o arquivo [PLANO_SKILLS_XJUR_V2.md](C:\.Sistemas\Xjur\PLANO_SKILLS_XJUR_V2.md) como base de organizacao das skills.
