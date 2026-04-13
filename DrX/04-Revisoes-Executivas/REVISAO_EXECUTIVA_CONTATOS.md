# Revisao Executiva do Modulo Contatos

## Papel do Modulo

`Contatos` deve ser a base mestre de identidade do DrX.

Hoje ele ja ocupa esse lugar em boa parte do sistema, mas com sinais de crescimento excessivo e mistura de responsabilidades.

## Leitura Executiva

O modulo esta forte em capacidade, mas ainda precisa amadurecer em fronteira.

### Pontos fortes

- ja funciona como ancora para varios modulos
- possui cadastro rico para PF, PJ e lead
- ja conversa com financeiro, processos e atendimento
- possui suporte a relacoes, patrimonio, contratos e sigilo

### Pontos de alerta

- o formulario ficou muito grande
- ha risco de o modulo virar deposito de contexto de outros dominios
- identidade multicanal ainda precisa ser mais explicitamente centralizada
- ha risco de duplicidade por canal, documento e cadastro parcial

## Diagnostico

### O que esta certo

- `Contact` esta bem posicionado como entidade ancora
- o modulo ja aceita amadurecimento progressivo
- a integracao com modulos vizinhos ja existe

### O que esta fragil

- excesso de responsabilidade visual no formulario
- pouca separacao entre dado estrutural e contexto derivado
- necessidade de fortalecer regras de deduplicacao e busca exata

## Decisao Executiva

O modulo `Contatos` deve continuar como base mestre do sistema.

Mas sua proxima fase nao deve ser "adicionar mais coisas".
Deve ser:

- fortalecer identidade
- reduzir bagunca de fronteira
- simplificar experiencia

## Diretriz de Evolucao

### 1. Fortalecer a identidade

- documento
- telefone
- WhatsApp
- email
- aliases

### 2. Reforcar fronteiras

- manter em contatos apenas o que ajuda a identificar, relacionar e contextualizar a pessoa ou empresa
- mover para outros dominios o que for tecnico demais ou operacional demais

### 3. Simplificar a experiencia

- tornar a tela mais clara
- separar melhor cadastro base de contexto relacionado
- reduzir peso cognitivo do formulario

## O que deve parar de crescer por enquanto

- configuracoes tecnicas de outros modulos
- segredos que nao pertencem ao contato
- informacoes operacionais que ja possuem dominio proprio

## Proxima Pergunta Estrategica

Qual deve ser o desenho definitivo da identidade multicanal no DrX:

- canal como campo no contato
- canal como identidade derivada
- ou modelo hibrido com alias oficiais

## Referencias

- [PLANO_MODULO_CONTATOS_XJUR.md](C:\.Sistemas\Xjur\DrX\01-Planos-Modulos\PLANO_MODULO_CONTATOS_XJUR.md)
- [SKILL.md](C:\.Sistemas\Xjur\DrX\02-Skills\modulo-contatos-xjur\SKILL.md)
