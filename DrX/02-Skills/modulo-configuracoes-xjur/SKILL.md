---
name: modulo-configuracoes-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir o modulo Configuracoes do XJUR como centro de governanca do tenant e nao como deposito de regras dispersas.
---

# Skill do Modulo Configuracoes do XJUR

Use esta skill sempre que o pedido envolver settings, preferencia global, segredo transversal, governanca de tenant ou organizacao de configuracoes.

## Missao

Garantir que `Configuracoes` concentre governanca transversal e nao absorva configuracoes que pertencem ao dominio de outros modulos.

## Leitura Minima Obrigatoria

- [PLANO_MODULO_CONFIGURACOES_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_CONFIGURACOES_XJUR.md)
- [Settings.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\Settings.tsx:1)
- [security.controller.ts](C:\.Sistemas\Xjur\apps\api\src\security\security.controller.ts:1)

## Regra de Ouro

Se uma configuracao so faz sentido dentro de um modulo especifico, ela provavelmente nao deve nascer em `Configuracoes`.
