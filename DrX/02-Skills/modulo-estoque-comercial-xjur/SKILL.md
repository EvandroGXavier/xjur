---
name: modulo-estoque-comercial-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir o modulo Estoque Comercial do XJUR, conectando produtos, compras, propostas, estoque, financeiro e fiscal sem inflar o nucleo juridico.
---

# Skill do Modulo Estoque Comercial do XJUR

Use esta skill sempre que o pedido envolver produtos, propostas, compras, estoque, inventario ou fluxo comercial.

## Missao

Garantir que `Estoque / Comercial` opere como trilha comercial disciplinada do XJUR, sem invadir o nucleo juridico ou duplicar responsabilidades do financeiro e fiscal.

## Leitura Minima Obrigatoria

- [PLANO_MODULO_ESTOQUE_COMERCIAL_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_ESTOQUE_COMERCIAL_XJUR.md)
- [products.service.ts](C:\.Sistemas\Xjur\apps\api\src\products\products.service.ts:1)
- [purchases.service.ts](C:\.Sistemas\Xjur\apps\api\src\purchases\purchases.service.ts:1)
- [proposals.service.ts](C:\.Sistemas\Xjur\apps\api\src\proposals\proposals.service.ts:1)
- [stock.service.ts](C:\.Sistemas\Xjur\apps\api\src\stock\stock.service.ts:1)

## Regra de Ouro

Se a mudanca nao fortalecer a cadeia produto, movimentacao, compra, proposta ou reflexo comercial, ela provavelmente pertence a outro modulo.
