# BATERIA E2E/MANUAL GUIADA - CONTATOS FRONTEND

## Objetivo

Validar a tela de Contatos ponta a ponta no frontend, cobrindo:

- navegacao pela lista e formulario
- inclusao, edicao e exclusao
- operacoes nas abas auxiliares
- persistencia real apos refresh e reabertura
- mensagens de erro e bloqueios esperados

Esta bateria foi montada com base na implementacao atual em:

- `apps/web/src/pages/contacts/ContactList.tsx`
- `apps/web/src/pages/contacts/ContactForm.tsx`
- `apps/api/src/contacts/contacts.controller.ts`
- `apps/api/src/contacts/contacts.service.ts`

## Ambiente recomendado

- frontend em `http://localhost:5173`
- backend em `http://localhost:3000`
- usuario autenticado com permissao para Contatos
- tenant de homologacao ou base de testes

## Convencao da massa de teste

Use nomes com prefixo para facilitar limpeza depois:

- `E2E LEAD CONTATO`
- `E2E PF CONTATO`
- `E2E PJ CONTATO`
- `E2E RELACIONADO`

Dados sugeridos:

### Lead

- nome: `E2E LEAD CONTATO`
- telefone: `31981112222`
- whatsapp: `31981112222`
- email: `e2e.lead@example.com`

### PF

- nome: `E2E PF CONTATO`
- cpf: `11144477735`
- telefone: `31982223333`
- whatsapp: `31982223333`
- email: `e2e.pf@example.com`
- nascimento: `1991-05-14`

### PJ

- nome fantasia: `E2E PJ CONTATO`
- razao social: `E2E PJ CONTATO LTDA`
- cnpj: `27865757000102`
- telefone: `3133345566`
- email: `e2e.pj@example.com`

### Endereco

- tipo: `Principal`
- cep: `30130110`
- numero: `123`
- complemento: `Sala 4`

### Contato adicional

- tipo: `EMAIL`
- nome: `Maria Financeiro`
- valor: `financeiro.e2e@example.com`

### Patrimonio

- tipo: `Veiculo E2E` ou tipo ja existente
- descricao: `Veiculo teste frontend`
- aquisicao: `2025-06-10`
- valor: `55000`
- observacoes: `Criado no teste E2E manual`

### Contrato

- tipo: `Honorarios`
- descricao: `Contrato mensal teste`
- vencimento dia: `10`
- primeiro vencimento: `2026-04-10`
- frequencia: `Mensal`
- natureza: `Receita`
- papel contraparte: `Contratante`
- contraparte: `Cliente E2E`
- observacoes: `Contrato criado pelo roteiro manual`

## Evidencias obrigatorias

Em todos os casos criticos, registrar:

- URL acessada
- mensagem toast exibida
- comportamento apos `F5`
- comportamento apos sair da tela e voltar
- se o dado reaparece na lista ou na aba correspondente

## Casos prioritarios

### CTT-E2E-001 - Abrir lista e navegar para novo contato

Objetivo: garantir que a tela principal carrega e abre o formulario.

Passos:

1. Acessar `/contacts`.
2. Confirmar que a grade aparece com o titulo `Contatos`.
3. Clicar em `Novo Contato`.

Esperado:

- lista carregada sem erro visual
- rota muda para `/contacts/new`
- titulo da tela mostra `Novo Contato`
- aba inicial ativa: `Contato`

### CTT-E2E-002 - Criar lead e validar persistencia basica

Objetivo: validar o fluxo minimo de criacao e reabertura.

Passos:

1. Em `/contacts/new`, manter `LEAD`.
2. Preencher nome, telefone, whatsapp e email do lead.
3. Clicar em `Salvar`.
4. Confirmar que a URL muda para `/contacts/{id}?tab=contact`.
5. Pressionar `F5`.
6. Clicar em `Voltar`.
7. Localizar o contato na lista pela busca.
8. Abrir o contato novamente.

Esperado:

- toast `Contato criado com sucesso!`
- apos `F5`, os dados continuam preenchidos
- o contato reaparece na lista
- a reabertura carrega o mesmo registro

### CTT-E2E-003 - Validar bloqueio de salvamento sem nome

Objetivo: garantir validacao no frontend antes do submit.

Passos:

1. Acessar `/contacts/new`.
2. Deixar nome vazio.
3. Preencher apenas telefone.
4. Clicar em `Salvar`.

Esperado:

- toast de aviso para preencher nome
- nenhum contato novo criado
- rota permanece em `/contacts/new`

### CTT-E2E-004 - Validar redirecionamento por duplicidade ao sair do campo

Objetivo: testar o lookup preventivo no frontend.

Pre-condicao:

- existir o contato `E2E LEAD CONTATO` criado no caso 002

Passos:

1. Acessar `/contacts/new`.
2. Informar o mesmo telefone ou email do contato ja existente.
3. Sair do campo com `Tab`.

Esperado:

- o sistema pode redirecionar automaticamente para o contato existente
- nao deve criar um segundo cadastro silenciosamente

Observacao:

- se o redirecionamento nao ocorrer, tentar salvar para confirmar se o backend bloqueia duplicidade

### CTT-E2E-005 - Converter lead para PF e validar abas

Objetivo: validar troca de tipo e exibicao das abas corretas.

Passos:

1. Abrir o contato criado no caso 002.
2. Alterar `Tipo de Pessoa` para `PF`.
3. Preencher CPF, nascimento e demais campos basicos.
4. Clicar em `Salvar Alteracoes`.
5. Verificar se a aba `PF` aparece.
6. Pressionar `F5`.

Esperado:

- toast `Contato atualizado com sucesso!`
- aba `PF` visivel
- valores de PF persistidos apos refresh

### CTT-E2E-006 - Criar contato PJ com consulta de CNPJ

Objetivo: validar enriquecimento, preenchimento automatico e persistencia.

Passos:

1. Acessar `/contacts/new`.
2. Alterar `Tipo de Pessoa` para `PJ`.
3. Informar CNPJ `27865757000102`.
4. Clicar em `Consultar CNPJ`.
5. Validar preenchimento automatico de nome, razao social e endereco.
6. Salvar o contato.
7. Reabrir o cadastro e ir para a aba `PJ`.

Esperado:

- toast de sucesso da consulta
- campos empresariais preenchidos
- endereco vindo da consulta aparece salvo
- dados persistem apos reabrir o contato

### CTT-E2E-007 - Enderecos: inclusao, edicao, exclusao e duplicidade

Objetivo: validar CRUD da aba `Enderecos`.

Pre-condicao:

- contato salvo e com ID real

Passos:

1. Abrir a aba `Enderecos`.
2. Clicar em `Adicionar Endereco`.
3. Informar CEP e aguardar preenchimento automatico.
4. Completar numero e complemento.
5. Salvar.
6. Confirmar o item na lista.
7. Tentar cadastrar exatamente o mesmo endereco novamente.
8. Editar o endereco e alterar o numero.
9. Salvar.
10. Pressionar `F5`.
11. Excluir o endereco.

Esperado:

- toast `Endereco adicionado!`
- duplicidade bloqueada com aviso
- toast `Endereco atualizado!`
- apos `F5`, a alteracao permanece
- toast `Endereco removido!`
- item some da lista apos exclusao

### CTT-E2E-008 - Contatos extras: inclusao, edicao e exclusao

Objetivo: validar CRUD da aba `Contatos`.

Passos:

1. Abrir a aba `Contatos`.
2. Clicar em `Novo Contato Extra`.
3. Preencher tipo `EMAIL`, nome e valor.
4. Salvar.
5. Editar o contato adicional para outro valor.
6. Salvar.
7. Pressionar `F5`.
8. Excluir o contato adicional.

Esperado:

- toast `Contato adicionado!`
- toast `Contato atualizado!`
- valor atualizado persiste apos refresh
- toast `Contato removido!`

### CTT-E2E-009 - Vinculos: criar, bloquear duplicidade invertida e excluir

Objetivo: validar a aba `Vinculos` com os bloqueios novos do backend.

Pre-condicao:

- existir um segundo contato chamado `E2E RELACIONADO`

Passos:

1. Abrir a aba `Vinculos`.
2. Criar um vinculo entre o contato atual e `E2E RELACIONADO`.
3. Confirmar o toast de sucesso.
4. Tentar criar o mesmo vinculo novamente.
5. Abrir `E2E RELACIONADO`.
6. Tentar criar o vinculo inverso de volta para o primeiro contato.
7. Excluir o vinculo original.

Esperado:

- primeiro cadastro salvo com sucesso
- duplicidade direta bloqueada
- duplicidade invertida bloqueada
- exclusao remove o vinculo da listagem

### CTT-E2E-010 - Patrimonio: criar tipo, incluir, editar parcialmente e excluir

Objetivo: validar a aba `Patrimonio` e a correcao de patch parcial.

Passos:

1. Abrir a aba `Patrimonio`.
2. Criar um novo tipo de patrimonio ou selecionar um existente.
3. Informar descricao, data e valor.
4. Salvar.
5. Abrir o item para edicao.
6. Alterar apenas descricao e observacoes.
7. Salvar sem trocar o tipo.
8. Pressionar `F5`.
9. Excluir o patrimonio.

Esperado:

- toast `Patrimonio adicionado!`
- toast `Patrimonio atualizado!`
- tipo original permanece apos edicao parcial
- alteracoes persistem apos refresh
- toast `Patrimonio removido!`

### CTT-E2E-011 - Contratos: criar, editar parcialmente e excluir

Objetivo: validar a aba `Contratos` e a preservacao de campos omitidos no patch.

Passos:

1. Abrir a aba `Contratos`.
2. Clicar em `Novo Contrato`.
3. Preencher os campos obrigatorios.
4. Salvar.
5. Editar o contrato criado.
6. Alterar apenas `status` e `observacoes`.
7. Salvar.
8. Pressionar `F5`.
9. Validar se descricao, dia de vencimento e contraparte foram preservados.
10. Excluir o contrato.

Esperado:

- toast `Contrato adicionado!`
- toast `Contrato atualizado!`
- campos nao alterados continuam intactos
- apos `F5`, o contrato editado permanece correto
- toast `Contrato removido!`

### CTT-E2E-012 - Anexos: upload, reabertura e exclusao

Objetivo: validar upload e persistencia da aba `Anexos`.

Passos:

1. Abrir a aba `Anexos`.
2. Enviar 1 PDF pequeno e 1 imagem pequena.
3. Aguardar o progresso finalizar.
4. Abrir um anexo.
5. Pressionar `F5`.
6. Confirmar que os anexos continuam listados.
7. Excluir um anexo.

Esperado:

- toast de upload bem-sucedido
- anexo abre sem erro
- lista persiste apos refresh
- toast `Anexo removido com sucesso!`

### CTT-E2E-013 - Lista: busca, filtros e retorno do formulario

Objetivo: validar navegacao entre lista e formulario com persistencia visual.

Passos:

1. Voltar para `/contacts`.
2. Buscar por `E2E`.
3. Testar filtro de status.
4. Testar cartoes rapidos `PF`, `PJ` e `Recentes`.
5. Abrir um contato, editar o nome, salvar e sair.
6. Confirmar que a lista reflete a alteracao.

Esperado:

- busca retorna os cadastros de teste
- filtros respondem sem erro
- `Salvar e Sair` retorna para a lista
- nome alterado aparece na grade

### CTT-E2E-014 - Exclusao de contato com e sem vinculos

Objetivo: validar exclusao total e inativacao por dependencia.

Passos:

1. Escolher um contato de teste sem dependencias.
2. Excluir pela lista.
3. Confirmar que some da grade.
4. Escolher um contato que tenha vinculos auxiliares ou ligacoes com outros modulos.
5. Excluir pela lista.

Esperado:

- contato sem dependencia pode ser excluido
- contato com dependencia pode ser inativado em vez de removido
- quando inativado, aparece feedback coerente e o filtro `Somente Inativos` deve localiza-lo

### CTT-E2E-015 - Abas de leitura: WhatsApp, Agenda, Processos e Financeiro

Objetivo: validar abas alimentadas por outros modulos.

Pre-condicao:

- contato com conversa de WhatsApp, compromisso, processo e registro financeiro vinculados

Passos:

1. Abrir cada aba: `WhatsApp`, `Agenda`, `Processos` e `Financeiro`.
2. Validar se os cards/listas carregam.
3. Testar busca do financeiro.
4. Confirmar se os totais financeiros aparecem coerentes.

Esperado:

- sem erro de carregamento
- estado vazio tratado com mensagem amigavel quando nao houver dados
- quando houver dados vinculados, a listagem aparece corretamente

## Casos de erro recomendados

Executar tambem estes cenarios de borda:

- tentar adicionar endereco antes de salvar o contato
- tentar adicionar contrato antes de salvar o contato
- tentar adicionar patrimonio antes de salvar o contato
- informar CNPJ invalido e clicar em `Consultar CNPJ`
- informar CEP incompleto e sair do campo
- tentar criar vinculo sem selecionar contato destino
- tentar salvar patrimonio sem descricao, data ou valor
- tentar salvar contrato sem tipo, descricao ou contraparte

## Criterios de aprovacao

A bateria pode ser considerada aprovada quando:

- nenhum fluxo principal quebra navegacao ou persistencia
- todos os toasts correspondem ao resultado real
- refresh nao perde dados ja gravados
- exclusoes removem ou inativam conforme esperado
- abas auxiliares mantem consistencia ao reabrir o contato

## Pos-teste

Ao final:

1. buscar por `E2E`
2. excluir ou inativar os registros criados
3. validar se nao ficaram vinculos soltos
4. registrar qualquer divergencia com:
   - URL
   - contato usado
   - aba
   - passo
   - resultado obtido
   - resultado esperado
