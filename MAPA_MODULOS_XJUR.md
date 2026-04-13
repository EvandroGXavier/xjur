# Mapa de Modulos do XJUR

## Uso Deste Documento

Este arquivo existe para revisar o sistema modulo por modulo, sem entrar em implementacao ainda.

Para cada modulo, a pergunta nao e "o que ele tem hoje".
A pergunta e "como ele deveria nascer se estivessemos desenhando certo agora".

## Escala de Decisao

- `NUCLEO`: modulo central do produto
- `SUPORTE`: modulo importante, mas nao estruturante
- `EXPERIMENTAL`: modulo ainda em validacao
- `REVISAR`: modulo com escopo confuso ou arquitetura fraca

## Modulos

### 1. Dashboard

- papel atual: painel geral
- papel alvo: painel executivo orientado a trabalho real
- classificacao inicial: `SUPORTE`
- revisar:
  - quais indicadores importam de verdade
  - se o dashboard guia acao ou so exibe dados

### 2. Atendimento

- papel atual: inbox, tickets e omnichannel
- papel alvo: centro resiliente de entrada, historico e operacao
- classificacao inicial: `NUCLEO`
- revisar:
  - verdade da mensagem
  - verdade do atendimento
  - relacao entre contato, mensagem, ticket, processo e IA

### 3. Contatos

- papel atual: CRM e base unificada de pessoas e empresas
- papel alvo: entidade ancora do sistema
- classificacao inicial: `NUCLEO`
- revisar:
  - identidade unica por pessoa/empresa
  - canais e aliases
  - relacoes juridicas, comerciais e financeiras

### 4. Processos

- papel atual: gestao juridica
- papel alvo: espinha dorsal juridica do produto
- classificacao inicial: `NUCLEO`
- revisar:
  - estrutura da capa
  - timeline
  - partes
  - vinculo com atendimento, agenda, documentos e financeiro

### 5. Agenda

- papel atual: compromissos e fluxos
- papel alvo: camada operacional de tempo e responsabilidade
- classificacao inicial: `SUPORTE`
- revisar:
  - se e agenda simples ou motor de workflow leve
  - vinculos com processo, atendimento e follow-up

### 6. Financeiro

- papel atual: contas, cobrancas, recebimentos e banco
- papel alvo: motor financeiro confiavel do escritorio
- classificacao inicial: `NUCLEO`
- revisar:
  - contas a pagar e receber
  - cobranca automatizada
  - conciliacao
  - integracoes bancarias
  - emissao fiscal

### 7. Fiscal

- papel atual: emissao e controle de documentos fiscais
- papel alvo: camada fiscal especializada, acoplada ao financeiro
- classificacao inicial: `SUPORTE`
- revisar:
  - fronteira entre financeiro e fiscal
  - readiness de emissao
  - provedores por municipio e modelo

### 8. Estoque / Comercial

- papel atual: produtos, compras, propostas e pedidos
- papel alvo: modulo comercial acoplado ao financeiro e fiscal
- classificacao inicial: `SUPORTE`
- revisar:
  - se faz parte do produto-base ou de uma trilha separada
  - dependencias reais com o juridico

### 9. Biblioteca / Documentos

- papel atual: templates, geracao e organizacao documental
- papel alvo: inteligencia documental do escritorio
- classificacao inicial: `SUPORTE`
- revisar:
  - geracao
  - versionamento
  - armazenamento
  - integracao com processo e atendimento

### 10. IA / DrX-Claw / Skills

- papel atual: camada inteligente e automacoes cognitivas
- papel alvo: sistema operacional de assistencia do XJUR
- classificacao inicial: `NUCLEO`
- revisar:
  - papel da IA por modulo
  - limites de autonomia
  - skills do sistema versus skills por tenant

### 11. Configuracoes

- papel atual: central tecnica dispersa
- papel alvo: centro unico de governanca do tenant
- classificacao inicial: `SUPORTE`
- revisar:
  - o que e configuracao global
  - o que pertence ao modulo
  - o que deve sair da configuracao e ir para o dominio certo

### 12. SaaS / Multi-tenant

- papel atual: base de isolamento e plano
- papel alvo: plataforma estavel de operacao multiempresa
- classificacao inicial: `NUCLEO`
- revisar:
  - isolamento por tenant
  - billing
  - perfis
  - governanca

## Perguntas Obrigatorias Para Cada Modulo

1. Qual e a sua missao central
2. Qual entidade e o centro do dominio
3. Quais sao os fluxos obrigatorios
4. Quais integracoes ele precisa
5. Quais riscos existem hoje
6. O que deve parar de crescer ate ser redefinido

## Regra de Priorizacao

Primeiro revisar:

1. `Contatos`
2. `Atendimento`
3. `Processos`
4. `Financeiro`
5. `IA / Skills`

Depois revisar os modulos de suporte.
