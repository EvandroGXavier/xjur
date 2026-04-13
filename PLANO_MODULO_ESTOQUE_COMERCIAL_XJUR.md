# Plano do Modulo Estoque Comercial do XJUR

## Missao do Modulo

`Estoque / Comercial` existe para controlar produtos, compras, propostas, pedidos e movimentacoes de estoque conectadas ao financeiro e ao fiscal.

## Papel Estrategico

Ele pode ampliar o XJUR para uma camada comercial, mas precisa continuar disciplinado para nao competir com o nucleo juridico.

## Centro do Dominio

O centro do dominio e o ciclo comercial baseado em produto, proposta, compra e movimentacao.

## Verdades do Modulo

- produto e entidade base
- estoque e reflexo de movimentacao
- proposta e compra sao fluxos comerciais
- fiscal e financeiro consomem esse dominio, mas nao o substituem

## Escopo Nucleo

- cadastro de produtos
- compras
- propostas
- estoque
- dashboard operacional comercial

## Riscos Atuais

- escopo muito amplo
- mistura de comercial com juridico sem criterio
- excesso de superfícies paralelas

## Direcao de Evolucao

- decidir se e trilha base ou trilha complementar do produto
- reforcar a cadeia produto > proposta/compra > estoque > financeiro > fiscal
- reduzir duplicidade entre telas e submodulos

## Arquivos de Referencia do Codigo Atual

- [products.service.ts](C:\.Sistemas\Xjur\apps\api\src\products\products.service.ts:1)
- [purchases.service.ts](C:\.Sistemas\Xjur\apps\api\src\purchases\purchases.service.ts:1)
- [proposals.service.ts](C:\.Sistemas\Xjur\apps\api\src\proposals\proposals.service.ts:1)
- [stock.service.ts](C:\.Sistemas\Xjur\apps\api\src\stock\stock.service.ts:1)
- [Inventory.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\inventory\Inventory.tsx:1)
