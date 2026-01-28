# 📋 CHANGELOG - Módulo de Contatos DR.X

## Data: 27/01/2026
## Versão: 2.0.0 - Contatos Hardened

---

## 🎯 OBJETIVO
Implementar o módulo de Contatos V2 conforme especificado no PRD, com suporte completo a:
- Campos condicionais para Pessoa Física (PF) e Pessoa Jurídica (PJ)
- Enriquecimento automático de dados via APIs públicas (CNPJ e CEP)
- CRUD completo e funcional
- Categorização de contatos

---

## ✅ ALTERAÇÕES IMPLEMENTADAS

### 1. **BANCO DE DADOS (Prisma Schema)**

#### Arquivo: `packages/database/prisma/schema.prisma`

**Novos Campos Adicionados ao Model Contact:**

```prisma
personType        String    @default("PF") // PF ou PJ

// Campos Pessoa Física
cpf               String?
rg                String?
birthDate         DateTime?

// Campos Pessoa Jurídica
cnpj              String?
companyName       String?   // Razão Social
stateRegistration String?   // Inscrição Estadual

// Campos Gerais
category          String?   // Cliente, Fornecedor, Parte Contrária, Perito, Funcionário

// Índices para Performance
@@index([cpf])
@@index([cnpj])
@@index([personType])
@@index([category])
```

#### Migration SQL
**Arquivo:** `packages/database/prisma/migrations/20260127_add_contact_fields/migration.sql`

- Adiciona todos os novos campos
- Remove constraint unique do campo `document` (mantido para compatibilidade)
- Cria índices para otimização de queries

---

### 2. **BACKEND (NestJS)**

#### 2.1 DTOs Atualizados

**Arquivo:** `apps/api/src/contacts/dto/create-contact.dto.ts`

**Novos Campos:**
- `personType`: Tipo de pessoa (PF ou PJ) com validação
- `cpf`, `rg`, `birthDate`: Campos de Pessoa Física
- `cnpj`, `companyName`, `stateRegistration`: Campos de Pessoa Jurídica
- `category`: Categorização do contato

**Validações Implementadas:**
- `@IsIn(['PF', 'PJ'])` para personType
- `@IsDateString()` para birthDate
- Transformações para converter strings vazias em null

#### 2.2 Serviço de Enriquecimento

**Arquivo:** `apps/api/src/contacts/enrichment.service.ts`

**Funcionalidades:**

1. **Consulta CNPJ (ReceitaWS)**
   - Endpoint: `GET /contacts/enrich/cnpj?cnpj=00000000000000`
   - Retorna: Razão Social, Nome Fantasia, Endereço, Telefone, Email, CNAE
   - Tratamento de erros: Rate limiting, CNPJ inválido, serviço indisponível

2. **Consulta CEP (ViaCEP)**
   - Endpoint: `GET /contacts/enrich/cep?cep=00000000`
   - Retorna: Logradouro, Bairro, Cidade, UF
   - Tratamento de erros: CEP inválido, não encontrado

**Integrações:**
- ReceitaWS: `https://receitaws.com.br/v1/cnpj/{cnpj}`
- ViaCEP: `https://viacep.com.br/ws/{cep}/json/`

#### 2.3 Controller Atualizado

**Arquivo:** `apps/api/src/contacts/contacts.controller.ts`

**Novos Endpoints:**
- `GET /contacts/enrich/cnpj?cnpj=` - Consulta dados de CNPJ
- `GET /contacts/enrich/cep?cep=` - Consulta dados de CEP

#### 2.4 Módulo Atualizado

**Arquivo:** `apps/api/src/contacts/contacts.module.ts`

- Adicionado `EnrichmentService` aos providers

---

### 3. **FRONTEND (React + Vite)**

#### 3.1 Formulário de Contato Reformulado

**Arquivo:** `apps/web/src/pages/contacts/ContactForm.tsx` (novo)

**Funcionalidades Implementadas:**

1. **Seleção de Tipo de Pessoa**
   - Radio buttons para PF ou PJ
   - Exibição condicional de campos baseada na seleção

2. **Campos Condicionais - Pessoa Física**
   - Nome Completo
   - CPF
   - RG
   - Data de Nascimento

3. **Campos Condicionais - Pessoa Jurídica**
   - Nome Fantasia
   - Razão Social
   - CNPJ com botão "Consultar"
   - Inscrição Estadual

4. **Enriquecimento Automático**
   - Botão "Consultar CNPJ": Preenche automaticamente dados da empresa
   - Botão "Consultar CEP": Preenche automaticamente endereço
   - Feedback visual durante consulta (loading state)
   - Alertas de sucesso/erro

5. **Campos Gerais**
   - Celular (obrigatório)
   - WhatsApp
   - E-mail
   - Categoria (dropdown com opções pré-definidas)
   - Observações

6. **Categorias Disponíveis**
   - Cliente
   - Fornecedor
   - Parte Contrária
   - Perito
   - Funcionário
   - Advogado
   - Juiz
   - Testemunha
   - Outro

**Arquivo Antigo:** Renomeado para `ContactForm_old.tsx` (backup)

---

## 🔧 DEPENDÊNCIAS NECESSÁRIAS

### Backend
```bash
npm install axios
```

### Frontend
Nenhuma dependência adicional necessária (já utiliza bibliotecas existentes).

---

## 📝 PRÓXIMOS PASSOS (Não Implementados)

### 1. **ContactList - Melhorias Pendentes**
- [ ] Implementar busca funcional (atualmente apenas UI)
- [ ] Adicionar filtros avançados (por categoria, tipo de pessoa, etc.)
- [ ] Implementar exportação Excel/PDF
- [ ] Adicionar paginação
- [ ] Exibir badge de categoria na lista

### 2. **Validações Avançadas**
- [ ] Validação de CPF/CNPJ no frontend
- [ ] Máscara de formatação para CPF/CNPJ/Telefone
- [ ] Validação de duplicidade de CPF/CNPJ

### 3. **Histórico de Interações**
- [ ] Registrar todas as interações com o contato
- [ ] Timeline de eventos
- [ ] Integração com módulo de comunicação

### 4. **Testes**
- [ ] Testes unitários para EnrichmentService
- [ ] Testes de integração para endpoints
- [ ] Testes E2E para formulário

---

## 🚀 COMO APLICAR AS ALTERAÇÕES

### 1. Atualizar Banco de Dados
```bash
cd /home/ubuntu/xjur/packages/database
npx prisma migrate dev --name add_contact_fields
npx prisma generate
```

### 2. Instalar Dependências
```bash
cd /home/ubuntu/xjur
npm install
```

### 3. Build e Deploy
```bash
npm run build
pm2 restart all
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Compatibilidade**: O campo `document` foi mantido para compatibilidade com código legado, mas os novos campos `cpf` e `cnpj` devem ser usados preferencialmente.

2. **Rate Limiting**: A API ReceitaWS tem limite de requisições. Em caso de erro 429, aguardar alguns minutos.

3. **Validação de Dados**: As validações de CPF/CNPJ devem ser implementadas no frontend para melhor UX.

4. **Migração de Dados**: Contatos existentes terão `personType` = 'PF' por padrão. Revisar e atualizar conforme necessário.

---

## 📊 STATUS DO MÓDULO

| Funcionalidade | Status | Observações |
|---|---|---|
| Schema do Banco | ✅ Completo | Todos os campos implementados |
| DTOs Backend | ✅ Completo | Validações implementadas |
| CRUD Backend | ✅ Completo | Create, Read, Update, Delete funcionais |
| Enriquecimento CNPJ | ✅ Completo | Integração com ReceitaWS |
| Enriquecimento CEP | ✅ Completo | Integração com ViaCEP |
| Formulário Frontend | ✅ Completo | Campos condicionais e enriquecimento |
| Lista Frontend | ⚠️ Parcial | Busca e filtros não funcionais |
| Exportação | ❌ Pendente | Excel/PDF não implementados |
| Validações Frontend | ⚠️ Parcial | Falta validação de CPF/CNPJ |
| Testes | ❌ Pendente | Nenhum teste implementado |

---

## 🎉 CONCLUSÃO

O módulo de Contatos V2 está **funcionalmente completo** para as operações CRUD e enriquecimento de dados. As funcionalidades pendentes são melhorias de UX e não impedem o uso do sistema.

**Próxima Revisão:** Implementar busca, filtros e exportação na lista de contatos.
