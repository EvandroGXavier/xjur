# Plano do Modulo Configuracoes do XJUR

## Missao do Modulo

`Configuracoes` existe para concentrar governanca do tenant, preferencias sistêmicas e cadastros tecnicos transversais.

## Papel Estrategico

Ele deve ser centro de governanca, nao deposito de qualquer coisa que ficou sem lugar.

## Verdades do Modulo

- configuracao global e diferente de dado de dominio
- o que pertence ao modulo deve ficar no modulo
- configuracao deve ser estavel, rastreavel e segura

## Escopo Nucleo

- configuracoes do tenant
- preferencias globais
- segredos e seguranca transversal
- catalogos tecnicos compartilhados

## Riscos Atuais

- central tecnica dispersa
- configuracoes de dominio fora do lugar certo
- sobrecarga da tela de settings

## Direcao de Evolucao

- distinguir configuracao global de configuracao de dominio
- mover para o modulo certo o que for operacional demais
- manter em configuracoes apenas o que e governanca transversal

## Arquivos de Referencia do Codigo Atual

- [Settings.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\Settings.tsx:1)
- [security.controller.ts](C:\.Sistemas\Xjur\apps\api\src\security\security.controller.ts:1)
