# Manual de Backup e Restauracao

## Objetivo

Usar a aba `BACK` em Configuracoes para:

- gerar um backup completo da base atual
- baixar o arquivo para armazenamento seguro
- enviar o arquivo para outro ambiente
- restaurar esse backup em uma base de teste

## Quem pode usar

Somente o SuperAdmin.

## Requisitos do servidor

O servidor precisa ter as ferramentas do PostgreSQL:

- `pg_dump`
- `pg_restore`
- `psql`

Se nao estiverem no `PATH`, configure uma destas variaveis:

- `PG_BIN_PATH`
- `PG_DUMP_PATH`
- `PG_RESTORE_PATH`
- `PSQL_PATH`

## Fluxo recomendado: producao para teste

1. Entre no ambiente de producao.
2. Abra `Configuracoes > BACK`.
3. Clique em `Criar Backup Completo`.
4. Aguarde o arquivo aparecer na biblioteca.
5. Clique em `Baixar`.
6. Entre no ambiente de teste.
7. Abra `Configuracoes > BACK`.
8. Use `Subir Backup Externo` para enviar o arquivo baixado da producao.
9. Na lista, clique em `Restaurar`.
10. Digite `RESTAURAR` para confirmar.

## Boas praticas

- Restaure em homologacao ou teste, nunca direto em producao sem janela controlada.
- Antes de restaurar, confirme qual banco aparece no card `Base Atual`.
- Guarde os arquivos `.backup` com data e contexto da operacao.
- Depois da restauracao, valide login, usuarios, contatos, processos e financeiro.

## Observacao importante

A restauracao completa pode sobrescrever dados da base atual.
