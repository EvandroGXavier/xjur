# Product Requirements Document (PRD) - DR.X

## 1. Visão Geral do Produto
O **DR.X** é um Ecossistema Jurídico Comercial (SaaS Multi-tenant) desenhado para atender escritórios de advocacia, departamentos jurídicos e empresas comerciais. Ele combina a robustez de um sistema de gestão processual e financeira com o dinamismo de um CRM moderno, atendimento omnichannel (com foco forte em WhatsApp), e gestão de documentos nativamente integrada ao Microsoft 365.

## 2. Objetivos e Problemas Resolvidos
- **Fragmentação de Ferramentas:** Unificar CRM, acompanhamento de processos processuais, gestão financeira, atendimento ao cliente (WhatsApp/Tickets) e gestão de estoque em uma única plataforma.
- **Automação de Atendimento:** Centralizar as conversas de WhatsApp via Evolution API, permitindo triagem inteligente, registro no histórico do cliente e geração de tickets automatizados.
- **Gestão Documental Ágil:** Eliminar o tráfego de arquivos editáveis usando integração profunda com o OneDrive/SharePoint e edição simultânea via Word Online, tudo versionado no sistema.
- **Organização Financeira Robusta:** Gerenciar despesas, receitas, rateios processuais (Transaction Splits) entre partes (credor/devedor), e parcelamentos, trazendo previsibilidade e conciliação para escritórios jurídicos.

## 3. Público-Alvo
- **Escritórios de Advocacia (Pequeno a Grande porte):** Necessitam gerenciar processos, clientes (PF/PJ), compromissos e faturamento.
- **Departamentos Jurídicos:** Foco em controle de demandas internas, tickets e controle financeiro de litígios.
- **Empresas Comerciais (Módulo Comercial):** Utilizam o sistema para gestão de estoque, produtos, fornecedores e controle financeiro avançado.

## 4. Escopo e Funcionalidades Principais (Core Features)

### 4.1. Core SaaS Multi-Tenant
- Arquitetura baseada em `Tenant` (locatários).
- Gestão de Planos de Assinatura (ex: BASIC, PRO, FULL) controlando limite de usuários e armazenamento.
- Controle de Usuários e Permissões (OWNER, ADMIN, MEMBER).

### 4.2. Gestão de Contatos e CRM
- Cadastro inteligente de Pessoas Físicas (PF) e Jurídicas (PJ), com detalhamento avançado (CPF, CNPJ, CNH, dados da Receita Federal).
- Regras de Validação Dinâmicas por Tenant (ex: forçar telefone ou email).
- Árvore de Relacionamentos (`ContactRelation`) e Gestão de Patrimônio dos clientes (`ContactAsset`).

### 4.3. Módulo Jurídico (Case Management)
- Registro de Processos Judiciais e Extrajudiciais, associados aos Contatos e Tenants.
- Timeline do Processo (`ProcessTimeline`) para acompanhamento de andamentos judiciais e movimentações internas.
- Gestão das Partes do Processo (`ProcessParty`) e seus papéis (Autor, Réu, Testemunha).
- Identificadores padrão (CNJ, NPU, Vara, Comarca, Instância).

### 4.4. Módulo Financeiro
- Lançamentos de Contas a Pagar (Despesas) e a Receber (Receitas).
- Controle de parcelamentos, juros, multas, honorários e rateios de transações (`TransactionSplit`).
- Categorização Dinâmica (Árvore de Categorias).
- Contas Bancárias e Conciliação Financeira.

### 4.5. Omnichannel e Comunicação (Integração WhatsApp)
- Conexão de instâncias de WhatsApp local/remota via **Evolution API**.
- Caixa de entrada centralizada com registro de ocorrências na Timeline do cliente.
- Envio e recebimento de mensagens ricas (texto, imagem, áudio, vídeos, documentos).
- Módulo de **Tickets de Atendimento** para estruturar demandas não processuais (Webchat, Email, WhatsApp).

### 4.6. Módulo de Documentos e M365 (Integração Microsoft)
- Estruturação automática de pastas no OneDrive por Tenant e por Processo.
- Geração de documentos `.docx` a partir de templates, com link de edição direta via Word Online.
- Versionamento `DocumentHistory` centralizado no banco.

### 4.7. Agenda de Compromissos
- Agendamento de audiências, prazos judiciais, e reuniões.
- Inclusão de Participantes com controle de confirmação.

### 4.8. Estoque e Produtos (Módulo Comercial)
- Cadastro de Produtos (código de barras, preço de custo, preço de venda).
- Inventário e movimentações (`InventoryMovement` - In, Out, Adjust).
- Cadastro de Fornecedores.

## 5. Requisitos Técnicos
- **Ambiente de Desenvolvimento:** IDX com setup `docker-compose` (Banco de dados PostgreSQL local + pgvector na imagem `ankane/pgvector`).
- **Arquitetura:** Monorepo gerenciado pelo `Turborepo`.
- **Backend:** NestJS ("apps/api"), Node.js >= 20, Evolution API (para mensageria).
- **Frontend:** React/Vite ("apps/web"), com interfaces ricas (Material UI/Tailwind/Components).
- **Banco de Dados:** PostgreSQL com Prisma ORM (`packages/database`). Dados sensíveis isolados logicamente por `tenantId`.
- **Regras Operacionais:** Testar LOCAL primeiro. Uso do "Botão de Pânico" (`npm run db:backup:local` e `npm run db:restore:local`) para rollback em caso de falhas críticas de infraestrutura.

## 6. Milestones de Evolução (Próximos Passos)
1. **Estabilização Omnichannel:** Finalizar todas as interações do WhatsApp (respostas agendadas, envio de mídia massiva/fluxos).
2. **Rollout Microsoft 365:** Garantir sync perfeito dos arquivos locais com o OneDrive for Business, além do isolamento dos tokens MS por Tenant.
3. **Dashboards Financeiros:** Implementar BI e gráficos avançados sobre a rentabilidade de contratos/processos.
4. **Inteligência Artificial (IA):** Adicionar resumos gerados por IA das movimentações do tribunal para linguagem amigável ao cliente (via WhatsApp), com suporte ao pgvector para RAG.

---
*Fim do Documento.*
