---
name: modulo-saas-multi-tenant-xjur
description: Skill oficial para analisar, planejar, revisar e evoluir a camada SaaS e Multi-tenant do XJUR como base de isolamento, governanca e operacao da plataforma.
---

# Skill do Modulo SaaS Multi Tenant do XJUR

Use esta skill sempre que o pedido envolver tenant, plano, isolamento, administracao SaaS, permissao, quota ou governanca de plataforma.

## Missao

Garantir que a camada `SaaS / Multi-tenant` preserve isolamento, seguranca e operacao correta da plataforma inteira.

## Leitura Minima Obrigatoria

- [PLANO_MODULO_SAAS_MULTI_TENANT_XJUR.md](C:\.Sistemas\Xjur\PLANO_MODULO_SAAS_MULTI_TENANT_XJUR.md)
- [saas.service.ts](C:\.Sistemas\Xjur\apps\api\src\saas\saas.service.ts:1)
- [saas.controller.ts](C:\.Sistemas\Xjur\apps\api\src\saas\saas.controller.ts:1)

## Regra de Ouro

Se uma mudanca coloca em risco isolamento ou governanca do tenant, ela precisa ser tratada como decisao estrutural, nao como ajuste local.
