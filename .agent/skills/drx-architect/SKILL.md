---
name: drx-architect
description: Comprehensive documentation, PRDs, architecture, and protocols for the DR.X project. Use this skill to understand the system context.
---

# Documentação e Protocolos do Projeto DR.X

Este documento consolida todos os PRDs, decisões arquiteturais e protocolos operacionais para o sistema DR.X (XavierAdv). Use isto como a referência primária para entender o escopo do projeto, stack tecnológica e regras de negócio.

## 🗣️ DIRETRIZ DE IDIOMA E COMUNICAÇÃO (OBRIGATÓRIO)
**Regra Suprema**: Toda a comunicação com o Operador, documentação, comentários de código, nomes de tabelas, campos, funções e arquivos devem ser **100% em Português Brasil (PT-BR)**.
- **Proibido**: `user_id`, `created_at`, `Tenant`, `Customer`.
- **Obrigatório**: `id_usuario`, `criado_em`, `Empresa`, `Cliente`.
- **Exceção**: Termos técnicos intraduzíveis de bibliotecas externas (ex: `npm install`, `docker-compose`, chaves do Clerk como `publicMetadata`).

## 🛡️ PROTOCOLO DR.X: AMBIENTE IDX AUTÔNOMO (FULL-STACK DEV)

### 1. INDEPENDÊNCIA E ISOLAMENTO (TESTE LOCAL PRIMEIRO)
A IDX agora possui seu próprio ecossistema. O fluxo de trabalho é:
1. Codificar na IDX.
2. Testar na IDX (usando o Banco Local e API local).
3. Validar.
4. Deploy via Git (Somente quando estiver 100% pronto).

### 2. CONFIGURAÇÃO DO BANCO LOCAL (DOCKER NA IDX)
Para que você não precise do banco da VPS para testes, usaremos um container Docker na IDX. O arquivo `docker-compose.yml` na raiz deve configurar o banco `drx_local` com `pgvector`.

### 3. O BOTÃO DE PÂNICO (RESTORE DE EMERGÊNCIA)
Sempre que iniciarmos uma alteração crítica (ex: mudar o banco), criaremos um Ponto de Restauração local.
- **Backup**: `npm run db:backup:local` (gera um arquivo .sql na pasta /backups).
- **Restore**: `npm run db:restore:local` (volta o banco ao estado anterior em 5 segundos).

---

## 🩺 PRD SUPREMO: SISTEMA DR.X (VERSÃO 2026 - FULL CONTEXT)

### 1. IDENTIDADE E VISÃO (BRANDING)
- **Nome**: DR.X – Inteligência Jurídica Autônoma.
- **Conceito**: Fusão do AtendeChat (WhatsApp Engine) + Xavier-Adv (ERP Jurídico).
- **Visual**: Azul Profundo e Prata. Ícone: Letra "X" estilizada com balança da justiça.
- **Propósito**: Triagem automática de leads via WhatsApp e conversão em processos jurídicos organizados.

### 2. INFRAESTRUTURA DE SERVIDOR (VPS)
Este é o "coração" onde o sistema bate em produção.
- **Host IP**: 185.202.223.115
- **Diretório Raiz do Projeto**: `/www/wwwroot/DrX/`
- **Ambiente de Desenvolvimento**: GOOGLE IDX (`C:\.sistemas\Xjur`)

### 3. CONEXÃO COM BANCO DE DADOS (POSTGRESQL - PRODUÇÃO)
O banco de dados roda localmente na VPS, mas com porta personalizada para segurança.
- **URL de Conexão (Prisma/JDBC)**: `postgresql://postgres:572811Egx@185.202.223.115:5433/meu_projeto_vps`
- **Extensões Obrigatórias**: uuid-ossp e pgvector (necessário para a IA Dr.X).

### 3.1 CONEXÃO LOCAL (DEV - USO OBRIGATÓRIO NA IDX)
Para desenvolvimento e testes, use SEMPRE esta string de conexão:
- **URL**: `postgresql://drx_dev:drx_local_pass@localhost:5432/drx_local`
- **Ambiente**: Docker Local (Container `drx_db_local`).
- **Comando de Backup**: `npm run db:backup:local`

### 4. PROTOCOLO DE SEGURANÇA E CHAVES (GITHUB ACTIONS)
Para que o "Deploy One-Click" funcione, segredos estão configurados no GitHub (VPS_SSH_KEY, VPS_HOST, VPS_USERNAME).

### 5. ARQUITETURA TÉCNICA (MONOREPO TURBO)
O sistema é dividido em compartimentos (pacotes):
1. `apps/api` (Backend): NestJS na porta 3000. Gerencia a IA e o WhatsApp.
2. `apps/web` (Frontend): React + Vite na porta 8080 (Produção) / 5173 (Dev).
3. `packages/database`: Onde mora o schema.prisma e o cliente do banco.
4. `WhatsApp Engine`: Baseado em @whiskeysockets/baileys. (Logger deve usar require('pino')).

### 6. MÓDULOS & FUNCIONALIDADES (ONDE PARAMOS)
#### 6.1 Módulo de Contatos (V2 Hardened)
- **Unificação**: Um contato é a mesma pessoa no Chat, Jurídico e Financeiro.
- **Enriquecimento**: Consulta CNPJ e CEP via API integrada no NestJS.

#### 6.2 Módulo de Processos (EPROC/TJMG Style)
- **Tabela Satélite**: `processos_tj` unificada (fim da duplicidade JSONB).
- **Campos de Automação**: Competência, Chave do Processo, Justiça Gratuita, Nível de Sigilo.

#### 6.3 Módulo Agenda V2
- **Fluxos Transacionais**: Agendas com etapas sequenciais.
- **Partes**: Multi-participantes (Solicitante, Responsável, Envolvido).

#### 6.4 Módulo Biblioteca (Visual Law)
- **Editor**: Tiptap Pro com extensões para Visual Law.
- **Output**: Geração de DOCX/PDF com QR Code de validade.

### 7. PROTOCOLO DE DEPLOY (MODO OPERADOR)
Sempre que finalizar uma alteração no Google IDX:
1. **Sincronizar**: `git add .` -> `git commit -m "Explicação"` -> `git push origin main`.
2. **Automatização**: GitHub Actions entra na VPS, roda install, build e PM2 restart.
3. **Logs**: Se cair, rodar `pm2 logs` na VPS.

### 8. CONFIGURAÇÕES DINÂMICAS (DOMÍNIOS)
- **App**: `https://dr-x.xtd.com.br`
- **API**: `https://api.dr-x.xtd.com.br`
- **Prisma Studio**: `https://studio.dr-x.xtd.com.br` (porta 5555).

---

## 🩺 PRD SUPREMO: MÓDULO SAAS (GESTÃO MULTI-TENANT)

### 1. FLUXO DE ACESSO E ONBOARDING (A JORNADA DO NOVO CLIENTE COM CLERK)
#### 1.1 Autenticação via Clerk
- **Plataforma**: Utilização da Clerk (clerk.com) para autenticação completa (Entrar, Cadastrar, Perfil).
- **Componentes**: Uso dos componentes pré-construídos do Clerk (`<SignIn />`, `<SignUp />`, `<UserButton />`) no Frontend.
- **Integração Backend**: Validação de tokens JWT do Clerk no NestJS via Guard (`ClerkAuthGuard`).
- **Sincronização de Usuários**: Webhooks do Clerk disparam eventos para o Backend (NestJS) para criar/atualizar o usuário no banco de dados local (`Usuario` e `Empresa`).

#### 1.2 Cadastro e Multi-Tenancy com Clerk
1. **Cadastro**: O usuário se cadastra no Clerk.
2. **Webhook**: O Clerk envia um webhook `user.created` para a API do DR.X.
3. **Criação de Empresa (Tenant)**: O Backend processa o webhook:
   - Cria uma nova `Empresa` para este usuário (se for um novo cadastro independente).
   - Cria o registro na tabela `Usuario` vinculado à `Empresa` no banco local.
   - Atribui o `publicMetadata.id_empresa` (antigo tenantId) no objeto do usuário no Clerk para persistência de contexto.

### 2. GESTÃO ESTRUTURAL (SUPERADMIN)
- **Painel de Controle**: Lista de escritórios, Status (Bloquear/Liberar), Cota.
- **Gestão de Planos**: Criar planos (Básico, Pro, Completo) e vincular a escritórios.

### 3. SEGURANÇA E ISOLAMENTO (DETALHES TÉCNICOS)
- **Interceptor de Empresa**: No NestJS, intercepta queries Prisma e adiciona `id_empresa` automaticamente. Garantia de isolamento de dados.
- **Autenticação**: O `ClerkAuthGuard` verifica o token Bearer e extrai o `id_usuario` e `id_empresa` (dos metadados ou do banco via e-mail).

### 4. CONFIGURAÇÃO DE AMBIENTE (CLERK)
**IMPORTANTE**: Para que a integração funcione, você deve configurar as seguintes variáveis nos arquivos `.env` locais (não commitar chaves reais aqui):

**Frontend (`apps/web/.env`):**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_... (Pegar no Painel Clerk)
```

**Backend (`apps/api/.env`):**
```bash
CLERK_SECRET_KEY=sk_test_... (Pegar no Painel Clerk)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_... (Gerar no menu Webhooks do Clerk)
```

### 5. ESPECIFICAÇÕES DO USUÁRIO MESTRE (SUPERADMIN)
- **E-mail**: `evandro@conectionmg.com.br`
- **Permissão Especial**: Ignora filtros de `id_empresa` na tela de Gestão SaaS.

### 6. PLANO DE IMPLEMENTAÇÃO (PASSO A PASSO)
1. **Fase 1 (Banco)**: Renomear/Criar tabela `Empresa` e incluir `id_empresa` em todas as tabelas.
2. **Fase 2 (Backend)**: Configurar `ClerkAuthGuard` e Endpoint de Webhook para Sincronização.
3. **Fase 3 (Frontend)**: Substituir telas de login pelos componentes do Clerk.

---

## 📄 DOCUMENTO CONSOLIDADO DE PRDs - XTD ERP Juridico (XavierAdv)

### ÍNDICE DE MÓDULOS (Ordem do Menu)
1. **Dashboard**
2. **Processos** (Gestão de casos jurídicos)
3. **Contatos** (CRM completo V2)
4. **ATENDIMENTO** (Central de atendimento)
    4.1*WhatsApp** (Integração WhatsApp Business)
    4.2*Telefonia** (VoIP/SIP)
    4.3*E-mail

7. **Etiquetas** (Tags e categorização)
8. **Agenda** (Compromissos e fluxos)
9. **Financeiro** (Contas a pagar/receber)
    9.1 Contas a Pagar
    9.2 Contas a Receber
    9.3 Fluxo de Caixa
    9.4 Relatórios Financeiros
    9.5 Cadastro de Contas Bancarias.
10. **Estoque** (Produtos, compras e vendas)
    10.1 Produtos
    10.2 Compras
    10.3 Vendas
    10.4 Propostas vendas
    10.5 Cotação
    10.6 Ordem de serviço(É UM AGENDAMENTO)
    10.7 Estoque
11. **Documentos** (Gestão de arquivos)
12. **Biblioteca V2** (Modelos Visual Law)
13. **E-mails** (Configurações e automações)
14. **Relatórios** (Dashboards e exports)
15. **Configurações** (Preferências do sistema)
16. **SaaS Admin** (Gestão multi-tenant)

### DETALHAMENTO DOS MÓDULOS ESTABELECIDOS

#### 2. PROCESSOS (GESTÃO JURÍDICA)
- **Estrutura de Abas (Padrão ERP)**:
  1. **Capa** (Visão Geral):
     - *Campos Principais*: Número CNJ, Título (Cliente x Parte Contrária), Status, Valor da Causa, Data Distribuição.
     - *Detalhes do Foro*: Tribunal, Comarca, Vara, Juiz, Sistema (PJe/Eproc).
     - *Classificação*: Área (Cível, Trabalhista, etc.), Classe Judicial, Assunto Principal.
  2. **Movimentações**:
     - *Lista*: Linha do tempo com andamentos processuais.
     - *Funcionalidade*: Botão "Capturar do Tribunal" (Crawler).
  3. **Partes**:
     - *Lista*: Autores, Réus, Advogados, Terceiros.
     - *Vínculo*: Conectado ao cadastro de Contatos.
  4. **Prazos e Audiências**:
     - *Lista*: Datas críticas, Audiências (Una, Instrução), Prazos Fatais.
     - *Integração*: Sincronizado com a Agenda Geral.
  5. **Documentos**:
     - *Lista*: Peças, Decisões, Documentos Probatórios.
     - *Funcionalidade*: Upload e Geração Automática.
  6. **Financeiro**:
     - *Honorários*: Contratuais (Entrada/Parcelas) e Sucumbenciais.
     - *Despesas*: Custas Processuais, Diligências.
  7. **Tarefas**:
     - *Lista*: Pendências vinculadas ao processo (Ex: "Protocolar Petição").

- **Status Integrados (Kanban)**:
  - *Fluxo*: Oportunidade -> Em Analise -> Contratado -> Em Andamento -> Suspenso -> Arquivado -> Encerrado.

- **Tabelas do Banco (Mapeamento PT-BR)**: mude o schema para PT-BR e os nomes das tabelas para PT-BR
  - `processos` (schema: `processes`)
  - `processos_movimentacoes` (schema: `process_movements`)
  - `processos_partes` (schema: `process_parties`)
  - `processos_documentos` (schema: `process_attachments`)
  - `processos_financeiro` (schema: `process_fees`)

- **Operações CRUD & Regras de Negócio**:
  - **Create**: Via Importação Automática (Crawler CNJ) ou Cadastro Manual (Processos Extrajudiciais).
  - **Read**: Listagem com paginação e filtros avançados (Parte, Fase, Tribunal).
  - **Update**: Edição manual de campos liberada. Movimentações são imutáveis após importadas (apenas append).
  - **Delete**: "Soft Delete" (arquivamento lógico). Proibido excluir se houver financeiro vinculado.

#### 3. CONTATOS (CRM V2)
#### 3. CONTATOS (CRM V2)
- **Estrutura de Abas (Ordem Fiel do Site)**:
  1. **Contato** (Principal):
     - *Campos*: NomeFantasia* (ou Nome Completo), WhatsApp*, Telefone, E-mail, **CPF/CNPJ** (Campo Único), Observações.
     - *Classificação Automática*:
       - **Lead**: Quando o campo CPF/CNPJ estiver vazio.
       - **Pessoa Física**: Quando CPF/CNPJ tiver 11 dígitos.
       - **Pessoa Jurídica**: Quando CPF/CNPJ tiver 14 dígitos.
     - *Regra de Espelhamento*: O dado inserido no campo **CPF/CNPJ** desta aba é automaticamente replicado para o campo correspondente nas abas "Dados PF" (campo CPF) ou "Dados PJ" (campo CNPJ).
  2. **Endereços**:
     - *Lista*: Gestão de múltiplos endereços.
     - *Campos*: CEP (Consultar ao sair do campo), Logradouro, Número, Complemento, Bairro, Cidade, Estado. Tipo de Endereço (Residencial, Comercial, Escritório).
  3. **Meios de Contato** (Adicionais):
     - *Campos*: Tipo (Email/Telefone/WhatsApp/Outro), Valor.
  4. **Dados PF** (Visível apenas se Pessoa Física):
     - *Campos*: **CPF** (Espelho da aba Principal), RG, Data de Nascimento.
  5. **Dados PJ** (Visível apenas se Pessoa Jurídica):
     - *Campos*: **CNPJ** (Espelho da aba Principal), Razão Social, Inscrição Estadual.
     - *Receita Federal*: Situação Cadastral, Capital Social, Natureza Jurídica, Data Abertura, Porte.
     - *Atividades*: CNAE Principal e Secundários.
     - *QSA*: Quadro de Sócios e Administradores.
  6. **Vínculos**:
     - *Funcionalidade*: Relacionar contatos (Ex: Sócio de, Pai de, Cônjuge de).
     - *Opções*: Bilateralidade automática.
  7. **Anexos**:
     - *Funcionalidade*: Upload de documentos (PDF, Imagens).
  8. **Patrimônio**:
     - *Campos*: Tipo (Imóvel/Veículo), Descrição, Valor, Data Aquisição, Baixa.
  9. **Contratos**:
     - *Lista*: Contratos gerados e assinados.
  10. **WhatsApp**:
      - *Funcionalidade*: Histórico de conversas e botão para iniciar chat.
  11. **Financeiro**:
      - *Lista*: Transações (Honorários, Custas) vinculadas ao contato.
  12. **Processos**:
      - *Lista*: Casos jurídicos ativos e arquivados.
  13. **Agenda**:
      - *Lista*: Compromissos, Audiências e Prazos.

- **Tabelas do Banco (Mapeamento PT-BR)**: mude o chema para PB-BR e os nomes das tabelas para PT-BR
  - `contatos` (schema: `contacts`)
  - `contato_enderecos` (schema: `addresses`)
  - `contato_meios` (schema: `additional_contacts`)
  - `contato_vinculos` (schema: `contact_relations`)
  - `contato_patrimonio` (schema: `contact_assets`)

- **Operações CRUD & Regras de Negócio**:
  - **Create**: Cadastro unificado. Validação estrita de unicidade por CPF/CNPJ (Bloqueia duplicados).
  - **Read**: Busca global (Elastic/PgVector) por nome fonético ou documento.
  - **Update**: Edição completa. Alteração de CPF/CNPJ dispara revalidação de vínculos.
  - **Delete**: "Soft Delete". Contatos com Processos ou Financeiro ativo não podem ser excluídos permanentemente.
  - **Merge**: Ferramenta de fusão de duplicados (A > B, move vínculos de B para A, e arquiva B).
  
#### 4. ATENDIMENTO (Central Omnichannel)
- **Visão Geral**: Hub centralizador de comunicações que converte múltiplas fontes em Tickets unificados.
- **Canais Integrados**:
  1. **WhatsApp Business** (Principal): Mensagens, Áudios e Mídia.
  2. **E-mail**: IMAP/SMTP. Cada e-mail recebido vira um Ticket; respostas viram reply.
  3. **Telefonia (VoIP)**: Registro de chamadas (CDR) e gravação anexada ao Ticket.
  4. **WebChat**: Widget no site do escritório.
- **Funcionalidades da Caixa de Entrada Unificada**:
  - *Filas*: Distribuição automática por departamento (Financeiro, Jurídico).
  - *SLA*: Controle de tempo de resposta.
  - *Template*: Respostas rápidas e macros.
- **Componentes de Interface**:
  - `KanbanBoard`: Colunas (Aguardando, Em Atendimento, Resolvido).
  - `ChatWindow`: Interface estilo WhatsApp Web, mas agnóstica ao canal.
  - `NewTicketDialog`: Abertura manual de atendimento.
- **Operações CRUD**:
  - **Create**: 
    - *Automático*: Webhook (Whats), Email Inbound ou Chamada Perdida.
    - *Manual*: Abertura por operador para registrar contato ativo.
  - **Read**: Filtros por Canal, Agente, Data, Tag e Cliente.
  - **Update**: Troca de fase no Kanban, Agendamento de retorno, Vínculo com Processo/Caso.
  - **Delete**: Arquivamento lógico (Histórico preservado para auditoria). Exclusão proibida.

#### 5. WHATSAPP V2 (NOVO)
- **Integração**: Evolution API.
- **Tabelas**: `wa_configuracoes`, `wa_contas`, `wa_contatos`, `wa_atendimentos`, `wa_mensagens`.
- **Operações CRUD**:
  - **Create**: Conexão de nova instância (QR Code).
  - **Read**: Monitoramento de status da conexão (CONNECTED, PAIRING).
  - **Update**: Alteração de webhook ou re-autenticação.
  - **Delete**: Desconexão e logout da instância (Wipe session).

#### 7. ETIQUETAS (Categorização Avançada)
- **Visão Geral**: Sistema transversal de classificação para organizar Contatos, Processos, Financeiro e Documentos através de marcadores visuais.
- **Estrutura de Abas e Funcionalidades**:
  1. **Gerenciador de Etiquetas** (Lista Principal):
     - *Colunas*: Visual (Badge Colorido), Nome da Etiqueta, Módulos Permitidos, Métrica de Uso (Qtd), Status.
     - *Filtros*: Por Módulo de Aplicação, Por Status (Ativa/Arquivada).
  2. **Nova Etiqueta** (Modal de Criação):
     - *Abas do Modal*:
       - **Geral**:
         - *Campos*: Nome (Obrigatório), Cor de Fundo (Picker), Cor da Fonte, Descrição.
       - **Regras de Aplicação** (Escopo):
         - *Checkboxes*: Onde esta etiqueta aparece? [ ] Contatos, [ ] Processos, [ ] Financeiro, [ ] Tarefas.
         - *Permissão*: [ ] Exclusiva para Admins, [ ] Uso Obrigatório em Novos Cadastros.
       - **Automação** (Gatilhos):
         - *Ação*: Quando aplicada -> Mover para Fase Kanban X, Enviar Alerta Y.
  3. **Relatórios de Uso**:
     - *Gráficos*: Distribuição de etiquetas por módulo, Top 10 etiquetas mais usadas.

- **Tabelas do Banco (Projeção PT-BR)**:
  - `etiquetas` (schema: `tags`)
  - `etiquetas_vinculos` (schema: `tag_relations` ou tabelas associativas como `tags_on_contacts`)

- **Operações CRUD**:
  - **Create**: Nova Etiqueta com definição de cor e escopo.
  - **Read**: Listagem com contagem de uso em tempo real.
  - **Update**: Renomear ou mudar cor (Reflete em todos os itens vinculados).
  - **Delete**: Exclusão lógica. Se tiver vínculos, exige confirmação para remover a tag dos itens.

#### 8. AGENDA (Gestão de Compromissos)
- **Visão Geral**: Módulo central para controle de prazos processuais, audiências e reuniões, com fluxos transacionais e múltiplos participantes.
- **Estrutura de Abas e Funcionalidades**:
  1. **Calendário** (Visão Principal):
     - *Modos*: Mensal, Semanal, Diária, Lista (Pauta).
     - *Interatividade*: Drag & Drop para reagendamento rápido.
     - *Filtros*: Por Advogado Responsável, Tipo de Evento, Status.
  2. **Novo Compromisso** (Modal Detalhado):
     - *Abas do Modal*:
       - **Geral**: Título, Tipo (Audiência, Prazo, Reunião), Data/Hora Início e Fim, Local (Virtual/Físico).
       - **Vínculos**: Processo (Busca Automática), Cliente (Busca Automática).
       - **Participantes**: Responsável (Interno), Envolvidos (Cliente, Testemunha, Perito).
       - **Notificações**: Configuração de lembretes (Email/WhatsApp) prévios.
       - **Recorrência**: Diária, Semanal, Mensal.
  3. **Fluxos Transacionais (Status)**:
     - *Ciclo de Vida*: Agendado -> Confirmado -> Em Andamento -> Realizado -> Cancelado -> Reagendado.
     - *Ações Específicas*: "Check-in" (Registrar presença), "Ata" (Upload pós-audiência).
  4. **Integrações**:
     - Sincronização automática com Prazos dos Processos.
     - Envio de convite .ics por e-mail.

- **Tabelas do Banco (Projeção PT-BR)**:
  - `agenda_eventos` (schema: `appointments`)
  - `agenda_participantes` (schema: `appointment_participants`)
  - `agenda_tipos` (schema: `appointment_types`)

- **Operações CRUD**:
  - **Create**: Novo Compromisso (Único ou Recorrente).
  - **Read**: Calendário (Dragable) e Pauta (Lista para impressão).
  - **Update**: Remarcar (Mudar Data) ou Reagendar (Mudar Status).
  - **Delete**: Cancelamento (Mantém histórico) ou Exclusão (Remove do banco se for erro de cadastro).

#### 9. FINANCEIRO (Gestão de Fluxo de Caixa)
- **Estrutura de Abas (Conforme Implementação)**:
  1. **Dashboard** (Visão Gerencial):
     - *Cards*: Receitas Totais/Pendentes, Despesas Totais/Pendentes, Saldo Atual, Contas a Pagar Vencidas.
     - *Gráficos/Listas*: Transações Recentes (Top 5).
  2. **Transações** (Livro Caixa):
     - *Filtros*: Busca Textual, Tipo (Receita/Despesa), Status (Pendente/Pago/Cancelado/Vencido).
     - *Colunas*: Descrição, Conta Bancária, Categoria, Vencimento, Status, Valor.
     - *Ações*: Editar, Excluir, Baixar (Mudar Status).
  3. **Contas Bancárias** (Gestão de Contas):
     - *Visualização*: Cards com Saldo, Dados da Agência/Conta e Titular Vinculado.
     - *Funcionalidade*: Cadastro de Contas Corrente/Poupança com vínculo a Contatos (Titulares).

- **Modais de Cadastro**:
  - **Nova Transação**:
    - *Campos*: Descrição*, Valor*, Vencimento*, Data Pagamento, Status, Tipo, Categoria, Método Pagamento, Conta Bancária, Observações.
  - **Nova Conta Bancária**:
    - *Campos*: Título*, Banco*, Tipo (Corrente/Poupança), Agência, Número, Saldo Inicial, Titular (Vínculo com Contato CPF/CNPJ).

- **Tabelas do Banco (Mapeamento PT-BR)**:
  - `transacoes_financeiras` (schema: `financial_records`)
  - `contas_bancarias` (schema: `bank_accounts`)
  - `bancos` (Listagem estática ou tabela auxiliar `banks`)

#### 10. ESTOQUE (Gestão de Materiais)
- **Visão Geral**: Controle de inventário, compras e saídas de materiais de escritório e equipamentos.
- **Estrutura de Abas**:
  1. **Produtos**: Lista de itens com Estoque Mínimo e Atual.
  2. **Movimentações**: Histórico de Entradas (Compras) e Saídas (Uso Interno).
  3. **Fornecedores**: Cadastro de parceiros comerciais.
- **Tabelas do Banco (Mapeamento PT-BR)**:
  - `produtos` (schema: `products`)
  - `movimentacoes_estoque` (schema: `inventory_movements`)
  - `fornecedores` (schema: `suppliers`)

- **Operações CRUD**:
  - **Create**: Cadastro de Produto (com código de barras) e Lançamento de Nota Fiscal (Entrada).
  - **Read**: Kardex (Ficha de movimentação de estoque).
  - **Update**: Ajuste de Inventário (Correção manual de saldo).
  - **Delete**: Produtos sem movimentação podem ser excluídos; com movimentação, apenas inativados.

#### 11. DOCUMENTOS (GED - Gestão Eletrônica)
- **Visão Geral**: Armazenamento e organização de arquivos finais gerados ou importados.
- **Funcionalidades**:
  - *Upload*: Arrastar e soltar para nuvem segura.
  - *Organização*: Pastas virtuais por Cliente ou Processo.
  - *Status*: Rascunho vs. Finalizado (Imutável).
- **Tabelas do Banco**:
  - `documentos` (schema: `documents`)

#### 12. BIBLIOTECA V2 (Modelos Visual Law)
- **Visão Geral**: Repositório central de templates inteligentes com suporte a varíaveis dinâmicas e design jurídico (Visual Law).
- **Estrutura de Abas e Funcionalidades**:
  1. **Acervo** (Navegação):
     - *Visualização*: Árvore de Categorias (Pastas Hierárquicas).
     - *Busca*: Indexação full-text pelo conteúdo do modelo.
  2. **Editor de Modelos** (Visual Law):
     - *Interface*: Editor de Texto Rico (WYSIWYG) com suporte a colunas e elementos gráficos.
     - *Variáveis Dinâmicas*: Inserção de placeholders (Ex: `{{cliente.nome}}`, `{{processo.juiz}}`) com autocompletar.
     - *Estilização Global*: Configuração de Cabeçalho, Rodapé e Fontes da banca.
  3. **Histórico de Versões**:
     - *Timeline*: Registro automático de alterações (Quem mudou, Quando).
     - *Restore*: Capacidade de reverter para qualquer versão anterior.
  4. **Categorias**:
     - *Gestão*: Criação de pastas e subpastas para organização taxonômica (Ex: Cível > Petições Iniciais > Danos Morais).

- **Tabelas do Banco (Mapeamento PT-BR)**:
  - `modelos_documentos` (schema: `document_templates`)
  - `categorias_documentos` (schema: `document_categories`)
  - `historico_documentos` (schema: `document_history`)
  - `configuracoes_documentos` (schema: `document_settings`)

#### 15. CONFIGURAÇÕES (Sistema e SaaS)
- **Visão Geral**: Painel unificado para preferências do usuário e gestão administrativa do ambiente SaaS (Multi-inquilino).
- **Estrutura de Abas (Conforme Implementação)**:
  1. **Opções** (Preferências):
     - *Funcionalidades*: Ativar/Desativar Modo Escuro, Notificações Sonoras.
  2. **Empresas** (Gestão de Inquilinos):
     - *Lista*: Tabela de empresas cadastradas com Status (Ativo/Inativo) e Plano.
     - *Ações*: Criar nova empresa, Editar dados, Resetar senha de admin.
  3. **Planos** (Gestão Financeira):
     - *Cards*: Visualização dos planos de assinatura (Basic, Pro, etc.).
     - *Edição*: Definir limites de usuários, armazenamento e preço.
  4. **Ajuda**:
     - *Recursos*: Links para suporte e documentação.
  5. **Whitelabel** (Personalização):
     - *Funcionalidades*: Ajuste de cores e logo da interface.

- **Tabelas do Banco (Mapeamento PT-BR)**:
  - `configuracoes_usuario` (schema: `user_settings` - *implícito*)
  - `saas_empresas` (schema: `tenants`)
  - `saas_planos` (schema: `plans`)

#### 16. PADRÕES DE GRID E LISTAGENS (GID - Grid Interface Design)
- **Objetivo**: Garantir consistência e alta produtividade em todas as telas de listagem do ERP.
- **Funcionalidades Obrigatórias**:
  1. **Ordenação (Sorting)**:
     - Todos os cabeçalhos de coluna devem ser clicáveis.
     - Ciclo: ASC -> DESC -> Original.
     - Indicador visual (Seta ou Ícone) obrigatório na coluna ativa.
  2. **Interatividade Inline (Smart Links)**:
     - *Emails*: Devem ser links `mailto:` (abrem cliente de email).
     - *Telefones*: Devem formatar links para WhatsApp Web ou `tel:` (mobile).
     - *Processos/Contatos*: Links clicáveis que abrem o modal de detalhes ou navegam para a página.
  3. **Etiquetas Visuais (Badges)**:
     - *Status*: Chips coloridos (Verde=Ativo/Pago, Vermelho=Vencido/Cancelado, Amarelo=Pendente).
     - *Categorias*: Tags com cores pastéis para fácil identificação visual (Ex: "Cliente", "Fornecedor").
  4. **Ações em Massa (Bulk Actions)**:
     - Checkbox na primeira coluna (Select All / Row Select).
     - Barra de ferramentas flutuante ao selecionar itens (Excluir, Exportar, Alterar Status em lote).
  5. **Paginação e Performance**:
     - Paginação server-side obrigatória para listas > 100 itens.
     - Seletor de "Itens por página" (10, 20, 50, 100).
  6. **Menu de Contexto**:
     - Botão "Mais Ações" (Três Pontos) na última coluna para ações secundárias (Arquivar, Auditoria, Clonar).

#### 18. PROTOCOLO MULTI-AGENTE (DELEGAÇÃO DE TAREFAS SIMULTÂNEAS)
- **Visão Geral**: Estratégia de desenvolvimento paralelo onde agentes autônomos assumem responsabilidade total por verticais do sistema.
- **Divisão de Responsabilidades (Squads)**:
  1. **AGENTE 01 (INFRA & CORE)**:
     - *Escopo*: Autenticação (Clerk), SaaS Admin (Gestão de Empresas/Planos), Configurações Gerais.
     - *Foco*: Garantir segurança, isolamento multi-tenant e estabilidade do backend.
  2. **AGENTE 02 (JURÍDICO & AUTOMAÇÃO)**:
     - *Escopo*: Processos (Crawler/Tribunais), Agenda (Prazos), Biblioteca V2 (Visual Law).
     - *Foco*: Inteligência jurídica, captura de dados e geração de documentos.
  3. **AGENTE 03 (CRM & COMUNICAÇÃO)**:
     - *Escopo*: Contatos V2, Etiquetas, Atendimento Omnichannel (WhatsApp/Email), CRM.
     - *Foco*: Experiência do cliente, funil de vendas e centralização de mensagens.
  4. **AGENTE 04 (FINANCEIRO & OPERAÇÕES)**:
     - *Escopo*: Financeiro (Fluxo de Caixa/Conciliação), Estoque (Materiais), Relatórios.
     - *Foco*: Precisão numérica, auditoria e controle de ativos.
  5. **AGENTE 05 (FRONTEND MASTER)**:
     - *Escopo*: Padronização GID (Grids), Design System, Acessibilidade, Performance UI.
     - *Foco*: Coerência visual e usabilidade em todos os módulos.

- **Fluxo de Trabalho Simultâneo**:
  - Cada agente deve respeitar o *Schema Prisma* compartilhado.
  - Alterações no banco exigem *Migration* (Deploy via Git).
  - Testes unitários obrigatórios antes do merge.

---

## 🛠️ FEATURE FLAGS
```javascript
const FEATURES = {
  PROCESSOS_V1: true,
  HONORARIOS_V1: true,
  AGENDA_V2: true,
  SAAS_V1: true,
  CONTATOS_V2: true,
  WHATSAPP_V2: true,
  BIBLIOTECA_V2: true,
  // ... (others as defined)
};
```

## ⚡ EDGE FUNCTIONS CONSOLIDADAS
- **WhatsApp**: `wa-send-message`, `wa-webhook`, etc.
- **IA/OCR**: `aid-process`, `processo-ocr`, `processar-nfe`.
- **Telefonia**: `telefonia-nova-chamada`, etc.
- **Email**: `send-email`, etc.

## 🔒 SEGURANÇA
- **Autenticação**: Clerk Auth com JWT (RS256).
- **RLS**: Row-Level Security em todas as tabelas com `id_empresa`.
- **Política**: `CREATE POLICY "isolamento_empresa" ON tabela FOR ALL USING (id_empresa = auth.uid());` - Adaptado para ler do contexto do Clerk.

## ⌨️ ATALHOS
- **GLOBAL**: `F1` (Manual do sistema).
- **CONTEXTUAL**: `F1` dentro de um módulo abre o manual específico daquele contexto.

---

### End of Documentation
Use this reference to maintain consistency across the project.


