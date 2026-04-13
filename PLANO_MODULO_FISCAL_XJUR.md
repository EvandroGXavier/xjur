# Plano do Modulo Fiscal do XJUR

## Missao do Modulo

`Fiscal` existe para transformar operacoes elegiveis em documentos fiscais validos, rastreaveis e emitiveis.

## Papel Estrategico

Ele e a camada especializada que prepara, valida, transmite e acompanha documentos fiscais, especialmente NF-e e NFS-e.

## Centro do Dominio

O centro do dominio e o documento fiscal e sua readiness de emissao.

### Estruturas centrais atuais

- `Invoice`
- `InvoiceItem`
- `InvoiceEvent`
- `FiscalConfig`

## Verdades do Modulo

- readiness vem antes da transmissao
- emissao fiscal depende de dados coerentes do financeiro e do cadastro
- provedor, municipio e modelo importam
- fiscal nao deve ser empilhado dentro do financeiro

## Escopo Nucleo

- configuracao fiscal
- readiness de emissao
- transmissao
- eventos de emissao
- acompanhamento de autorizacao e rejeicao

## Riscos Atuais

- mistura entre fiscal e financeiro
- dependencia excessiva de mocks
- acoplamento forte a provedores especificos

## Direcao de Evolucao

- fortalecer readiness
- separar melhor NF-e e NFS-e
- tratar provedores como adaptadores especializados
- melhorar visibilidade de erros de emissao

## Arquivos de Referencia do Codigo Atual

- [fiscal.service.ts](C:\.Sistemas\Xjur\apps\api\src\fiscal\fiscal.service.ts:1)
- [bh-nfse.gateway.ts](C:\.Sistemas\Xjur\apps\api\src\fiscal\providers\bh-nfse\bh-nfse.gateway.ts:1)
- [FiscalPage.tsx](C:\.Sistemas\Xjur\apps\web\src\pages\inventory\FiscalPage.tsx:1)
