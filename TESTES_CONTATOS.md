# 🧪 PLANO DE TESTES - Módulo de Contatos DR.X

## Data: 27/01/2026
## Versão: 2.0.0

---

## 📋 CHECKLIST DE TESTES

### ✅ BACKEND - API Endpoints

#### 1. CRUD Básico

##### 1.1 CREATE - Criar Contato
- [ ] **POST** `/contacts` - Criar Pessoa Física
  ```json
  {
    "name": "João da Silva",
    "personType": "PF",
    "cpf": "12345678900",
    "rg": "MG1234567",
    "birthDate": "1990-01-15",
    "phone": "31999887766",
    "email": "joao@email.com",
    "category": "Cliente"
  }
  ```
  **Esperado:** Status 201, retorna objeto com ID

- [ ] **POST** `/contacts` - Criar Pessoa Jurídica
  ```json
  {
    "name": "Empresa XYZ Ltda",
    "personType": "PJ",
    "cnpj": "12345678000190",
    "companyName": "XYZ Serviços Jurídicos Ltda",
    "stateRegistration": "123456789",
    "phone": "31999887766",
    "email": "contato@empresaxyz.com",
    "category": "Cliente"
  }
  ```
  **Esperado:** Status 201, retorna objeto com ID

- [ ] **POST** `/contacts` - Validação de campos obrigatórios
  ```json
  {
    "name": "",
    "phone": ""
  }
  ```
  **Esperado:** Status 400, mensagem de erro de validação

##### 1.2 READ - Listar e Buscar Contatos

- [ ] **GET** `/contacts` - Listar todos os contatos
  **Esperado:** Status 200, array de contatos ordenados por data de criação (desc)

- [ ] **GET** `/contacts/:id` - Buscar contato por ID
  **Esperado:** Status 200, objeto com contato incluindo addresses e additionalContacts

- [ ] **GET** `/contacts/invalid-id` - Buscar contato inexistente
  **Esperado:** Status 404 ou null

##### 1.3 UPDATE - Atualizar Contato

- [ ] **PATCH** `/contacts/:id` - Atualizar dados básicos
  ```json
  {
    "name": "João da Silva Atualizado",
    "email": "joao.novo@email.com"
  }
  ```
  **Esperado:** Status 200, objeto atualizado

- [ ] **PATCH** `/contacts/:id` - Alterar tipo de pessoa (PF para PJ)
  ```json
  {
    "personType": "PJ",
    "cnpj": "12345678000190",
    "companyName": "João da Silva ME"
  }
  ```
  **Esperado:** Status 200, campos de PJ preenchidos

##### 1.4 DELETE - Remover Contato

- [ ] **DELETE** `/contacts/:id` - Excluir contato
  **Esperado:** Status 200 ou 204

- [ ] **DELETE** `/contacts/invalid-id` - Excluir contato inexistente
  **Esperado:** Status 404

---

#### 2. Gerenciamento de Endereços

##### 2.1 CREATE Address

- [ ] **POST** `/contacts/:id/addresses` - Adicionar endereço
  ```json
  {
    "street": "Rua das Flores",
    "number": "123",
    "city": "Belo Horizonte",
    "state": "MG",
    "zipCode": "30130100"
  }
  ```
  **Esperado:** Status 201, endereço criado

##### 2.2 UPDATE Address

- [ ] **PATCH** `/contacts/:id/addresses/:addressId` - Atualizar endereço
  ```json
  {
    "number": "456"
  }
  ```
  **Esperado:** Status 200, endereço atualizado

##### 2.3 DELETE Address

- [ ] **DELETE** `/contacts/:id/addresses/:addressId` - Excluir endereço
  **Esperado:** Status 200 ou 204

---

#### 3. Enriquecimento de Dados

##### 3.1 Consulta CNPJ

- [ ] **GET** `/contacts/enrich/cnpj?cnpj=27865757000102` - CNPJ válido (Natura)
  **Esperado:** Status 200, dados da empresa (razão social, endereço, etc.)

- [ ] **GET** `/contacts/enrich/cnpj?cnpj=00000000000000` - CNPJ inválido
  **Esperado:** Status 400 ou 404, mensagem de erro

- [ ] **GET** `/contacts/enrich/cnpj?cnpj=123` - CNPJ com formato incorreto
  **Esperado:** Status 400, mensagem "CNPJ inválido"

##### 3.2 Consulta CEP

- [ ] **GET** `/contacts/enrich/cep?cep=30130100` - CEP válido (Belo Horizonte)
  **Esperado:** Status 200, dados do endereço (logradouro, bairro, cidade, UF)

- [ ] **GET** `/contacts/enrich/cep?cep=00000000` - CEP inválido
  **Esperado:** Status 404, mensagem "CEP não encontrado"

- [ ] **GET** `/contacts/enrich/cep?cep=123` - CEP com formato incorreto
  **Esperado:** Status 400, mensagem "CEP inválido"

---

### ✅ FRONTEND - Interface do Usuário

#### 4. Lista de Contatos (`/contacts`)

- [ ] Acessar página de listagem
  **Esperado:** Tabela com colunas Nome, Documento, Email, Telefone, Ações

- [ ] Verificar ordenação por data de criação (mais recentes primeiro)

- [ ] Clicar em "Novo Contato"
  **Esperado:** Redirecionar para `/contacts/new`

- [ ] Clicar em linha da tabela
  **Esperado:** Redirecionar para `/contacts/:id`

- [ ] Clicar no botão "Editar" (ícone de lápis)
  **Esperado:** Redirecionar para `/contacts/:id`

- [ ] Clicar no botão "Excluir" (ícone de lixeira)
  **Esperado:** Exibir confirmação, após confirmar o contato deve ser removido

- [ ] Verificar campo de busca (UI apenas)
  **Esperado:** Campo visível, mas sem funcionalidade (pendente)

---

#### 5. Formulário de Contato - Pessoa Física (`/contacts/new`)

##### 5.1 Seleção de Tipo de Pessoa

- [ ] Verificar radio button "Pessoa Física (PF)" selecionado por padrão

- [ ] Alternar para "Pessoa Jurídica (PJ)"
  **Esperado:** Campos de PF ocultados, campos de PJ exibidos

- [ ] Voltar para "Pessoa Física (PF)"
  **Esperado:** Campos de PJ ocultados, campos de PF exibidos

##### 5.2 Preenchimento de Campos PF

- [ ] Preencher "Nome Completo" (obrigatório)
- [ ] Preencher "CPF" (opcional)
- [ ] Preencher "RG" (opcional)
- [ ] Preencher "Data de Nascimento" (opcional)
- [ ] Preencher "Celular" (obrigatório)
- [ ] Preencher "WhatsApp" (opcional)
- [ ] Preencher "E-mail" (opcional)
- [ ] Selecionar "Categoria" (opcional)
- [ ] Preencher "Observações" (opcional)

##### 5.3 Salvar Contato PF

- [ ] Clicar em "Salvar Contato"
  **Esperado:** Redirecionar para `/contacts`, contato aparece na lista

- [ ] Tentar salvar sem preencher campos obrigatórios
  **Esperado:** Mensagem de validação do navegador

---

#### 6. Formulário de Contato - Pessoa Jurídica

##### 6.1 Preenchimento de Campos PJ

- [ ] Selecionar "Pessoa Jurídica (PJ)"
- [ ] Preencher "Nome Fantasia" (obrigatório)
- [ ] Preencher "Razão Social" (opcional)
- [ ] Preencher "CNPJ" (opcional)
- [ ] Preencher "Inscrição Estadual" (opcional)
- [ ] Preencher demais campos gerais

##### 6.2 Enriquecimento CNPJ

- [ ] Preencher CNPJ: `27865757000102` (Natura)
- [ ] Clicar em "Consultar"
  **Esperado:** 
  - Botão exibe "Consultando..."
  - Após sucesso, campos preenchidos automaticamente:
    - Nome Fantasia: "NATURA"
    - Razão Social: "NATURA COSMETICOS S.A."
    - Email e Telefone (se disponíveis)
  - Alerta de sucesso exibido

- [ ] Tentar consultar CNPJ inválido
  **Esperado:** Alerta de erro

##### 6.3 Salvar Contato PJ

- [ ] Clicar em "Salvar Contato"
  **Esperado:** Redirecionar para `/contacts`, contato aparece na lista

---

#### 7. Gerenciamento de Endereços

##### 7.1 Adicionar Endereço

- [ ] Abrir contato existente (modo edição)
- [ ] Clicar na aba "Endereços"
- [ ] Clicar em "Adicionar Endereço"
  **Esperado:** Formulário de endereço exibido

- [ ] Preencher CEP: `30130100`
- [ ] Clicar em "Consultar"
  **Esperado:**
  - Botão exibe "Consultando..."
  - Campos preenchidos automaticamente:
    - Logradouro: "Rua da Bahia"
    - Cidade: "Belo Horizonte"
    - Estado: "MG"
  - Alerta de sucesso exibido

- [ ] Preencher "Número"
- [ ] Clicar em "Adicionar"
  **Esperado:** Endereço adicionado à lista

##### 7.2 Editar Endereço

- [ ] Clicar no botão "Editar" de um endereço
  **Esperado:** Formulário preenchido com dados do endereço

- [ ] Alterar "Número"
- [ ] Clicar em "Atualizar"
  **Esperado:** Endereço atualizado na lista

##### 7.3 Excluir Endereço

- [ ] Clicar no botão "Excluir" de um endereço
  **Esperado:** Confirmação exibida

- [ ] Confirmar exclusão
  **Esperado:** Endereço removido da lista

---

### ✅ VALIDAÇÕES E EDGE CASES

#### 8. Validações de Dados

- [ ] Tentar criar contato com email inválido
  **Esperado:** Erro de validação

- [ ] Tentar criar contato com telefone com menos de 10 dígitos
  **Esperado:** Erro de validação

- [ ] Tentar criar contato com personType diferente de PF ou PJ
  **Esperado:** Erro de validação

- [ ] Verificar conversão de strings vazias para null
  **Esperado:** Campos opcionais vazios salvos como null no banco

#### 9. Casos Especiais

- [ ] Criar contato sem endereços
  **Esperado:** Sucesso, array de addresses vazio

- [ ] Criar contato PF e depois alterar para PJ
  **Esperado:** Campos de PF mantidos no banco, campos de PJ preenchidos

- [ ] Excluir contato com endereços
  **Esperado:** Endereços excluídos em cascata (onDelete: Cascade)

- [ ] Testar limite de requisições da API ReceitaWS
  **Esperado:** Após múltiplas consultas, erro 429 com mensagem apropriada

---

### ✅ PERFORMANCE E OTIMIZAÇÃO

#### 10. Queries do Banco

- [ ] Verificar uso de índices em queries
  ```sql
  EXPLAIN ANALYZE SELECT * FROM contacts WHERE cpf = '12345678900';
  EXPLAIN ANALYZE SELECT * FROM contacts WHERE cnpj = '12345678000190';
  EXPLAIN ANALYZE SELECT * FROM contacts WHERE personType = 'PF';
  ```
  **Esperado:** Queries utilizando índices criados

- [ ] Verificar tempo de resposta de listagem com 100+ contatos
  **Esperado:** < 500ms

---

## 🎯 CRITÉRIOS DE ACEITAÇÃO

### Funcionalidades Obrigatórias (MUST HAVE)
- ✅ CRUD completo de contatos funcionando
- ✅ Campos condicionais PF/PJ implementados
- ✅ Enriquecimento de CNPJ funcionando
- ✅ Enriquecimento de CEP funcionando
- ✅ CRUD de endereços funcionando
- ✅ Validações básicas implementadas

### Funcionalidades Desejáveis (SHOULD HAVE)
- ⚠️ Busca na lista de contatos (pendente)
- ⚠️ Filtros avançados (pendente)
- ⚠️ Exportação Excel/PDF (pendente)
- ⚠️ Validação de CPF/CNPJ no frontend (pendente)
- ⚠️ Máscaras de formatação (pendente)

### Funcionalidades Opcionais (NICE TO HAVE)
- ❌ Histórico de interações (não implementado)
- ❌ Paginação na lista (não implementado)
- ❌ Testes automatizados (não implementado)

---

## 📊 RESULTADO ESPERADO

Ao final dos testes, o módulo de Contatos deve:

1. ✅ Permitir criar, editar, visualizar e excluir contatos
2. ✅ Diferenciar Pessoa Física de Pessoa Jurídica
3. ✅ Enriquecer dados automaticamente via APIs públicas
4. ✅ Gerenciar múltiplos endereços por contato
5. ✅ Categorizar contatos (Cliente, Fornecedor, etc.)
6. ✅ Validar dados de entrada
7. ✅ Manter integridade referencial no banco de dados

---

## 🐛 REGISTRO DE BUGS

| ID | Descrição | Severidade | Status |
|---|---|---|---|
| - | - | - | - |

---

## ✅ ASSINATURA DE APROVAÇÃO

- [ ] Testes de Backend concluídos
- [ ] Testes de Frontend concluídos
- [ ] Testes de Integração concluídos
- [ ] Validações verificadas
- [ ] Performance aceitável
- [ ] Documentação atualizada

**Testador:** _________________  
**Data:** _________________  
**Aprovado:** [ ] Sim [ ] Não  
**Observações:** _________________
