---
name: modulo-fiscal-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir o modulo Fiscal do XJUR como camada especializada de readiness, transmissao e rastreio de documentos fiscais.
---

# Skill do Modulo Fiscal do XJUR

Use esta skill sempre que o pedido envolver nota fiscal, NFS-e, NF-e, readiness, transmissao, provedor fiscal ou configuracao fiscal.

## Missao

Garantir que `Fiscal` permaneça como camada especializada de emissao, sem ser confundido com financeiro central ou com integrações bancarias.

## Leitura Minima Obrigatoria

- [PLANO_MODULO_FISCAL_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_FISCAL_XJUR.md)
- [fiscal.service.ts](C:\.Sistemas\Xjur\apps\api\src\fiscal\fiscal.service.ts:1)
- [bh-nfse.gateway.ts](C:\.Sistemas\Xjur\apps\api\src\fiscal\providers\bh-nfse\bh-nfse.gateway.ts:1)
- [FiscalPage.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\inventory\FiscalPage.tsx:1)

## Regra de Ouro

Antes de emitir, valide readiness. Antes de integrar, separe com clareza o que e fiscal, o que e financeiro e o que e provedor.
