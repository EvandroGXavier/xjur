# 📊 Análise do Sistema Jurídico DR.X - Cowork Mode

**Data**: 3 de Abril de 2026
**Versão do Sistema**: 1.0.001
**Objetivo**: Otimizar as instruções para Claude em Cowork Mode baseado na compreensão real da arquitetura

---

## 1. VISÃO GERAL DO SISTEMA

O **DR.X** é um ecossistema jurídico comercial multi-tenant em arquitetura **SaaS** (Software as a Service) que funciona como plataforma de gerenciamento integral para escritórios de advocacia.

### Classificação do Projeto
- **Tipo**: Monorepo (Turborepo)
- **Estágio**: Production-Ready
- **Versão**: 1.0.001
- **Ambiente**: Multi-environment (Local + VPS)
- **Modelo de Deploy**: Docker + Kubernetes

---

## 2. STACK TÉCNICO IDENTIFICADO

### Backend (API)
- **Framework**: NestJS 10.x
- **Linguagem**: TypeScript
- **Banco de Dados**: PostgreSQL (com suporte a vetores para IA)
- **Cache**: Redis
- **ORM**: Prisma 5.20.0
- **Autenticação**: JWT + Passport
- **Comunicação Real-time**: WebSockets (Socket.io)
- **Agendamento**: @nestjs/schedule

### Frontend (Web)
- **Framework**: React 18.2
- **Build Tool**: Vite 5.x
- **Linguagem**: TypeScript
- **Styling**: TailwindCSS 3.x
- **UI Components**: Lucide React
- **Gerenciamento de Dados**: React Hook Form, Axios
- **Gráficos**: Recharts
- **Drag & Drop**: React Beautiful DND
- **Toast Notifications**: Sonner
- **Export**: html2pdf.js, QRCode

### Integrações Externas
- **WhatsApp API**: Evolution API (com instâncias customizáveis)
- **Microsoft 365**: Microsoft Graph Client (integração Office365)
- **IA Generativa**: OpenAI
- **Processamento de Mídia**: FFmpeg, Jimp
- **Processamento XML**: fast-xml-parser

### Browser Extension
- **Tipo**: Chrome Extension
- **Tecnologia**: React com tipos de Chrome

### Infraestrutura
- **Containerização**: Docker + Docker Compose
- **Orquestração**: Docker Compose (local) + Possível K8s (produção)
- **CI/CD**: GitHub Actions
- **Versionamento**: Git
- **Server Produção**: VPS com Nginx

---

## 3. ARQUITETURA DO MONOREPO

```
Xjur (root)
├── apps/
│   ├── api/              # NestJS Backend
│   ├── web/              # React Frontend (Vite)
│   ├── extension/        # Chrome Extension
│   └── storage/          # Serviço de armazenamento
├── packages/
│   └── database/         # Schemas Prisma compartilhados
├── scripts/              # Automação (versionamento, deploy)
├── tools/                # Ferramentas auxiliares
├── .agent/               # Configuração de agentes especializados
├── .codex/               # Base de conhecimento
└── docker-compose.yml    # Orquestração local
```

### Organização Modular (NestJS)
O sistema está dividido em **módulos de domínio**:
- `agent/` - Motor de IA (skills, análise jurídica)
- `auth/` - Autenticação e autorização
- `contacts/` - Gerenciamento de contatos (PF/PJ)
- `processes/` - Processos jurídicos e partes
- `documents/` - Documentação eletrônica
- `communications/` - Canais de comunicação
- `connections/` - Integrações (WhatsApp, Evolution)
- `appointments/` - Agenda e follow-ups
- `dashboard/` - Métricas e relatórios
- `backup/` - Backup e restore de dados

---

## 4. PRINCIPAIS FEATURES DO SISTEMA

### 4.1 Gestão de Processos Jurídicos
- Importação de PDFs de autos judiciais (PJe, eproc)
- Estruturação automática: polos, partes, procuradores, prazos
- Timeline de andamentos processual
- Rastreamento de pendências

### 4.2 Inteligência Artificial (DrX-Claw)
O sistema implementa **Skills** (conhecimento especializado):

#### Skills do Sistema (SYSTEM)
- `triagem-juridica` - Qualificação inicial de pedidos, urgência, gaps documentais
- `financeiro-cobranca` - Suporte a comunicações de cobrança e negociação
- `agenda-followup` - Sugestões de follow-ups e organização operacional
- `processo-eletronico-pje-eproc` - Leitura e análise de processos eletrônicos

#### Skills Customizáveis (CUSTOM)
- Criadas e gerenciadas por cada tenant
- Configuráveis via interface: `Configurações > Skills`

### 4.3 Comunicação Integrada
- **WhatsApp via Evolution API**: instâncias por cliente, webhooks configuráveis
- **Kanban de Atendimento**: vista card-based de conversas
- **Chat em Tempo Real**: WebSocket com notificações
- **Backup de Comunicações**: armazenamento estruturado

### 4.4 Integrações Externas
- **Microsoft 365**: Integração com Office365 para sincronização
- **OpenAI**: Análise e sugestões de conteúdo jurídico
- **Evolution API**: Gateway de WhatsApp (não oficial)

### 4.5 Gestão Financeira & Operacional
- Módulo de cobrança e vencimentos
- Rastreamento de pagamentos
- Agenda de compromissos
- Estoque/Inventário (recente)

---

## 5. FLUXO DE PROCESSAMENTO DE DOCUMENTOS

### Quando um PDF é enviado ao sistema:

```
PDF Integral do Processo
    ↓
[1] Extração estruturada do PDF
    ↓
[2] Cadastro/atualização do processo no DB
    ↓
[3] Sincronização de partes e procuradores
    ↓
[4] Acionamento de Skill: processo-eletronico-pje-eproc
    ↓
[5] DrX-Claw gera resumo operacional
    ↓
Processo estruturado e pronto para uso
```

---

## 6. PADRÕES E CONVENÇÕES OBSERVADOS

### Naming & Governança
- Skills `SYSTEM` = produto (identificadas no cadastro)
- Skills `CUSTOM` = específicas de cada empresa
- Correcções via `Configurações > Skills`
- Preferência por "pausar" em vez de deletar

### Versionamento
- Formato semântico em `package.json`
- Script automatizado: `npm run version:bump`
- Deploy automático via GitHub Actions
- Último commit: integração WhatsApp + Evolution API

### Ambiente Local vs Produção
| Componente | Local | Produção |
|-----------|-------|----------|
| PostgreSQL | Docker (`drx_db_local`) | Docker (`drx_db_prod`) |
| Redis | Docker (`drx_redis_local`) | Docker (`drx_redis_prod`) |
| Evolution | Docker (`drx_evolution_local`) | Docker (`drx_evolution_prod`) |
| API NestJS | Host (hot-reload) | Docker |
| Web React | Host (Vite) | Docker |

### Conectividade
- **Local**: Evolution (Docker) → NestJS (Host) via `host.docker.internal:3000`
- **Produção**: Todos na rede Docker interna (`drx_net_prod`)

---

## 7. HISTÓRICO RECENTE DE DESENVOLVIMENTO

(Últimos 20 commits)

1. ✅ **Integração WhatsApp**: Evolution API com suporte a instâncias customizáveis
2. ✅ **Novo módulo Atendimento V2**: Kanban melhorado para conversas
3. ✅ **Gerenciamento de Contatos**: Validação PF/PJ
4. ✅ **Settings Page**: Diagnósticos Microsoft 365
5. ✅ **Gestão de Inventário**: Dashboard de produtos, propostas, compras, fiscal
6. ✅ **CI/CD GitHub Actions**: Deploy automático em VPS
7. ✅ **Gerenciamento de Processos**: Services, controllers, timelines

**Foco Atual**: Consolidação de features WhatsApp e melhorias operacionais

---

## 8. ÁREAS DE EXTENSÃO DO SISTEMA

### 8.1 Pontos de Gancho (Hook Points)

1. **Sistema de Skills**
   - Novas skills podem ser criadas sem tocar no core
   - Interface de configuração já existe
   - Potencial para marketplace de skills

2. **Integrações**
   - Architecture permite novos provedores
   - Exemplo: Telegram, Signal, Slack, Teams
   - Modelo: estilo Evolution API

3. **Módulos de Domínio**
   - Fácil adicionar novos módulos NestJS
   - Estrutura clara de Services, Controllers, DTOs

4. **Dados**
   - Prisma schema em `packages/database`
   - Migrações automáticas possíveis

### 8.2 Áreas Potenciais de Melhoria
- Testes automatizados (sugerir cobertura)
- Documentação de API (Swagger/OpenAPI)
- Rate limiting e throttling
- Advanced monitoring (Datadog, New Relic)
- Cache estratégico (Redis pipelines)

---

## 9. RECOMENDAÇÕES PARA OTIMIZAR INSTRUÇÕES CLAUDE

### 9.1 **Instruções Atuais (Verificadas)**

> "Este é um projeto de um sistema jurídico modelo SAAS, e tem como objetivo ser autonomo e eficiente."

**Avaliação**: ✅ Corretas, mas **muito genéricas**

### 9.2 **Instruções Recomendadas (Melhoradas)**

```markdown
## Instruções para Claude - Projeto Xjur

Este é um **sistema jurídico SaaS em produção** (versão 1.0.001) chamado **DR.X**.

### Contexto Técnico
- **Monorepo** com Turborepo (apps/api, apps/web, apps/extension, packages/database)
- **Stack**: NestJS (TypeScript) + React + PostgreSQL + Redis
- **Integrações**: WhatsApp (Evolution API), Microsoft 365, OpenAI
- **Deploy**: Docker + Docker Compose (local) + VPS + GitHub Actions
- **Módulos-chave**: Auth, Contacts, Processes, Communications, Agent (IA), Skills

### Contexto Jurídico
- Gestão integral de processos judiciais (PJe, eproc)
- Sistema de skills IA para triagem, cobrança, agenda, análise processual
- Multi-tenant com configurações por empresa
- Foco em automação de fluxos jurídicos

### Quando Solicitar Ajuda:

1. **Desenvolvimento de Features**
   - Adicione sempre em módulo NestJS existente ou crie novo
   - Siga o padrão: Service → Controller → DTO → Integração Prisma
   - Considere multi-tenancy em qualquer nova funcionalidade

2. **Integrações**
   - Novos canais (Telegram, Slack): imitar padrão Evolution API
   - Novos provedores IA: estender agent.module.ts
   - Novos bancos de dados: considerar impacto em Prisma schema

3. **Skills & IA**
   - Skills SYSTEM vs CUSTOM têm governança diferente
   - Sistema de gatilhos e fluxos já existe
   - Playground do DrX-Claw para testes

4. **Deploy & Infra**
   - Local: `npm run dev` (apps em hot-reload)
   - Produção: `docker-compose -f docker-compose.prod.yml up -d`
   - Versionamento automático: `npm run version:bump && npm run deploy`

### Prioridades do Projeto
1. Estabilidade e confiabilidade (prod-ready)
2. Multi-tenancy robusta
3. Automação jurídica via IA (skills)
4. Integrações de canais de comunicação

### Governança & Boas Práticas
- Commits claros com mensagens descritivas
- Versionamento semântico
- GitHub Actions para CI/CD
- Documentação em `.md` compartilhada no projeto
```

### 9.3 **Memória para Futuras Sessões**

Recomendo que você crie um arquivo de memória em `.auto-memory/` contendo:

```markdown
---
name: Xjur System Architecture
description: DR.X legal SaaS monorepo structure, modules, and integration points
type: project
---

# Xjur Monorepo Overview

## Stack
- **API**: NestJS + TypeScript + PostgreSQL + Redis
- **Web**: React + Vite + TailwindCSS
- **Extension**: Chrome Extension (React)
- **DevOps**: Docker Compose + GitHub Actions + VPS

## Key Modules
- `agent/` - IA/Skills engine
- `connections/` - WhatsApp (Evolution), Microsoft 365
- `processes/` - Processual management
- `contacts/` - CRM for PF/PJ
- `documents/` - Document handling & extraction
- `communications/` - Multi-channel messaging
- `appointments/` - Scheduling & follow-ups

## Governance
- Skills: SYSTEM (product) vs CUSTOM (tenant-specific)
- Multi-tenancy: built-in across all modules
- Versionioning: Semver + auto-bump script
- Deploy: Local (npm run dev) → Prod (docker-compose.prod.yml)

## Recent Focus
- WhatsApp integration (Evolution API)
- Atendimento V2 (Kanban)
- Process management improvements
- CI/CD automation
```

---

## 10. SUGESTÕES IMEDIATAS PARA PRÓXIMAS SESSÕES

### 10.1 Documentação que Faltaria
- [ ] Swagger/OpenAPI documentation
- [ ] ER diagram (Prisma schema visual)
- [ ] API endpoints by module
- [ ] Skills catalog with examples
- [ ] Troubleshooting guide

### 10.2 Áreas para Exploração
- [ ] Coverage de testes (unitários, integração, e2e)
- [ ] Performance bottlenecks (Redis usage, DB queries)
- [ ] Security audit (JWT, CORS, validation)
- [ ] Logging strategy (Pino configuration)

### 10.3 Escalabilidade
- [ ] Database replication strategy
- [ ] Horizontal scaling (API instances)
- [ ] CDN para assets estáticos
- [ ] Message queue (Bull + Redis) para jobs assíncronos

---

## 11. RESUMO EXECUTIVO

| Aspecto | Status |
|--------|--------|
| **Arquitetura** | ✅ Bem estruturada (Turborepo) |
| **Stack Técnico** | ✅ Moderno e escalável |
| **Funcionalidades** | ✅ Abrangentes para jurídica |
| **Deploy** | ✅ Automatizado (GitHub Actions) |
| **Documentação** | ⚠️ Boa, mas poderia ser mais técnica |
| **Testes** | ❓ Não avaliado nesta análise |
| **Performance** | ❓ Não avaliado nesta análise |
| **Segurança** | ✅ Parecer de boas práticas |

---

## 12. PRÓXIMAS AÇÕES RECOMENDADAS

1. **Para você (DR.X)**:
   - Revisar e expandir instruções baseado neste documento
   - Criar arquivo `.claude.md` na raiz com instruções otimizadas
   - Documentar **patterns específicos** que quer que Claude siga

2. **Para Claude em Cowork Mode**:
   - Guardar esta análise em memória
   - Usar contexto de stack/arquitetura para sugestões inteligentes
   - Priorizar consistência com padrões existentes
   - Alertar sobre breaking changes em estrutura

---

**Documento preparado por**: Claude (Análise de Sistema)
**Última atualização**: 2026-04-03
**Confidencialidade**: Interno (Xjur)
