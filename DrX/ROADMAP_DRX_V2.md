# ROADMAP DRX V2

## Objetivo

Este roadmap organiza a reconstrucao planejada do DrX apos a revisao completa do XJUR.

Ele parte do principio de que nao vamos sair refazendo telas aleatoriamente.
Primeiro consolidamos a arquitetura mental do sistema, depois corrigimos fronteiras, e so entao evoluimos execucao.

## Regras do Roadmap

- primeiro revisar, depois executar
- cada modulo so avanca com missao e fronteiras claras
- entidades centrais nao podem ficar ambiguas
- integracoes entram depois da base do dominio estar correta
- skills acompanham a governanca dos modulos

## Fase 0. Base Estrategica

### Meta

Consolidar a nova base do sistema dentro da pasta `DrX`.

### Entregas

- plano de reinicio
- mapa de modulos
- planos por modulo
- skills por modulo
- mapas mentais do sistema

### Status

- concluido

## Fase 1. Revisao dos Modulos Nucleares

### Meta

Revisar os modulos que sustentam a identidade e a operacao do produto.

### Ordem

1. Contatos
2. Atendimento
3. Processos
4. Financeiro
5. IA / DrX-Claw / Skills
6. SaaS / Multi-tenant

### Saida esperada por modulo

- revisao executiva
- diagnostico do estado atual
- definicao do centro do dominio
- fronteiras com os outros modulos
- lista do que cresce, do que pausa e do que sai

## Fase 2. Revisao dos Modulos de Suporte

### Meta

Revisar os modulos que dependem da espinha dorsal do produto.

### Ordem

1. Dashboard
2. Agenda
3. Fiscal
4. Biblioteca / Documentos
5. Estoque / Comercial
6. Configuracoes

### Saida esperada

- alinhamento com os modulos nucleares
- simplificacao de responsabilidade
- definicao do que e suporte e do que e trilha propria

## Fase 3. Consolidacao das Fronteiras

### Meta

Cruzar os modulos para eliminar sobreposicoes e pontos de confusao.

### Temas obrigatorios

- contato versus atendimento
- processo versus atendimento
- financeiro versus fiscal
- financeiro versus bancario
- configuracoes globais versus configuracoes de dominio
- IA versus automacao versus operador humano

## Fase 4. Novo Backlog Estrutural

### Meta

Transformar a revisao em backlog executavel.

### Saidas

- backlog por modulo
- backlog transversal
- prioridades por impacto
- dependencias entre fases

## Fase 5. Execucao V2

### Meta

Executar a nova fase do DrX em cima de dominios mais claros.

### Regra

Nenhuma execucao nova deve entrar sem referencia ao plano do modulo correspondente.

## Artefatos de Referencia

- [PLANO_REINICIO_XJUR.md](C:\.Sistemas\Xjur\DrX\00-Base\PLANO_REINICIO_XJUR.md)
- [MAPA_MODULOS_XJUR.md](C:\.Sistemas\Xjur\DrX\00-Base\MAPA_MODULOS_XJUR.md)
- [PLANO_SKILLS_XJUR_V2.md](C:\.Sistemas\Xjur\DrX\00-Base\PLANO_SKILLS_XJUR_V2.md)

## Primeira Trilha Ativa

### Modulo 1

- `Contatos`

### Proxima entrega

- revisao executiva inicial do modulo
- diagnostico de riscos
- linha mestra da evolucao
