# Manual Inicial - Integracao Office 365

## Objetivo

Este guia mostra como configurar e validar a integracao Office 365 no DR.X para que a empresa consiga:

- autenticar no Microsoft Graph
- apontar a biblioteca correta do OneDrive ou SharePoint
- definir a pasta raiz onde os processos serao criados
- testar a criacao de pasta com seguranca
- documentar observacoes operacionais para o time

## Onde configurar

Existem dois pontos no sistema:

- `Configuracoes > Minha Empresa`
- `Configuracoes > Empresas > Editar Empresa`

Nos dois locais voce encontra o bloco `Integracao Microsoft 365`, com:

- `Ativar Armazenamento OneDrive/SharePoint`
- `Tenant ID`
- `Client ID`
- `Client Secret`
- `Drive ID / Biblioteca`
- `ID da Pasta Raiz`
- `Observacoes da Integracao`
- `Testar Integracao`

## Configuracao no Azure

1. Acesse o `Microsoft Entra ID`.
2. Entre em `App registrations`.
3. Clique em `New registration`.
4. Dê um nome claro para o app, por exemplo: `DRX - Office 365 - Empresa`.
5. Copie estes dois valores:
   - `Application (client) ID`
   - `Directory (tenant) ID`
6. Entre em `Certificates & secrets`.
7. Gere um novo segredo e copie o campo `Value`.

## Permissoes recomendadas

Em `API permissions`, adicione permissoes do tipo `Application` e depois clique em `Grant admin consent`.

Permissoes recomendadas:

- `Files.ReadWrite.All`
- `Sites.ReadWrite.All`
- `User.Read.All`

## Como preencher no DR.X

- `Tenant ID`: cole o `Directory (tenant) ID`
- `Client ID`: cole o `Application (client) ID` completo
- `Client Secret`: cole o `Value` do segredo
- `Drive ID / Biblioteca`: informe o ID da biblioteca onde esta a pasta principal
- `ID da Pasta Raiz`: informe a pasta mae onde os processos serao criados
- `Observacoes da Integracao`: registre ambiente, responsavel, data do teste, regras e observacoes do TI

## Sobre Drive ID e Pasta Raiz

O sistema trabalha melhor quando voce informa os dois valores:

- `Drive ID` identifica a biblioteca
- `Pasta Raiz` identifica a pasta mae dentro dessa biblioteca

Regra pratica:

- IDs que costumam comecar com `b!` geralmente sao `Drive ID`
- IDs que costumam comecar com `01` geralmente sao `ID de pasta/item`

Se voce informar apenas a pasta raiz, o sistema tenta descobrir o Drive automaticamente no teste. Mesmo assim, o recomendado e salvar os dois.

## Campo Observacoes

Use este campo para deixar a integracao autoexplicativa para o admin.

Exemplos:

- `Biblioteca oficial do juridico`
- `Conta aprovada pelo TI em 11/03/2026`
- `Ambiente de homologacao - nao usar para documentos finais`
- `Ultimo teste OK em 11/03/2026`

## Como testar

1. Salve a configuracao.
2. Clique em `Testar Integracao`.
3. O sistema executa estas validacoes:
   - valida formato do Tenant ID e Client ID
   - autentica no Azure
   - localiza a biblioteca/pasta configurada
   - cria uma pasta temporaria de teste
   - remove a pasta temporaria

## Resultado esperado

Quando tudo estiver correto, o diagnostico deve mostrar:

- autenticacao Azure OK
- pasta raiz localizada
- criacao de pasta OK
- limpeza do teste OK

## Problemas comuns

### Client ID invalido

Se o sistema informar que o app nao foi encontrado ou que o Client ID e invalido:

- revise o `Application (client) ID`
- confirme se o GUID esta completo
- nao use valores truncados

### Drive ID ausente

Se o sistema autenticar mas nao localizar a pasta:

- preencha tambem o `Drive ID / Biblioteca`
- confirme se a pasta raiz pertence a essa biblioteca

### Sem permissao

Se a autenticacao funcionar, mas a pasta nao puder ser criada:

- revise as permissoes `Files.ReadWrite.All` e `Sites.ReadWrite.All`
- confirme o `Grant admin consent`

## Checklist de liberacao

- app criado no Azure
- Tenant ID valido
- Client ID valido
- Client Secret valido
- permissoes Application concedidas
- admin consent executado
- Drive ID preenchido
- pasta raiz preenchida
- observacoes registradas
- teste de integracao aprovado

## Situacao validada neste ambiente

No teste executado em `11/03/2026`, a configuracao salva da empresa local nao conseguiu autenticar no Azure porque o `Client ID` cadastrado estava incompleto e o `Drive ID` ainda nao estava preenchido. Antes de esperar criacao de pastas, esses dois pontos precisam ser corrigidos.
