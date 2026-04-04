# 🚀 Guia Prático: Como Implementar Melhorias nas Instruções

**Objetivo**: Transformar instruções genéricas em diretrizes específicas que Claude possa seguir

---

## PARTE 1: Criar `.claude.md` na Raiz do Projeto

### Passo 1: Criar arquivo

```bash
touch .claude.md
```

### Passo 2: Copiar e adaptar este template

```markdown
# Instruções para Claude - Projeto DR.X Xjur

## 🎯 O Que é Este Projeto

**DR.X** é um ecossistema jurídico SaaS em produção que automatiza fluxos para escritórios de advocacia.

- **Status**: Production Ready (v1.0.001)
- **Tipo**: Monorepo (Turborepo) com 3 aplicações
- **Stack**: TypeScript full-stack + PostgreSQL + Redis
- **Escala**: Multi-tenant (múltiplos clientes isolados)

## 🏗️ Arquitetura Rápida

```
Xjur/
├── apps/api/          # NestJS (TypeScript) - Backend
├── apps/web/          # React (TypeScript) - Frontend
├── apps/extension/    # Chrome Extension
└── packages/database/ # Prisma Schema (compartilhado)
```

### Stack Técnico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Backend | NestJS | 10.x |
| Frontend | React + Vite | 18.2 |
| Database | PostgreSQL | (latest) |
| Cache/Queue | Redis | (latest) |
| ORM | Prisma | 5.20.0 |
| Auth | JWT + Passport | - |
| Deploy | Docker + GitHub Actions | - |

## ⚙️ Padrões de Código Que Claude Deve Seguir

### 1. Estrutura de Módulo NestJS

**Exemplo**: Adicionar feature em `contacts/`

```
src/contacts/
├── contacts.service.ts      # Lógica de negócio
├── contacts.controller.ts   # Endpoints HTTP
├── contacts.module.ts       # Declaração do módulo
├── dto/                     # Data Transfer Objects
│   ├── create-contact.dto.ts
│   └── update-contact.dto.ts
├── entities/               # Database models
│   └── contact.entity.ts
└── interfaces/             # TypeScript interfaces
    └── contact.interface.ts
```

**Regra**: Sempre coloque a lógica em `Service`, endpoints em `Controller`.

### 2. Multi-Tenancy

**Critério**: Toda query que lê/escreve precisa do `tenantId`.

```typescript
// ❌ ERRADO
async findAll() {
  return this.prisma.contact.findMany();
}

// ✅ CORRETO
async findAll(tenantId: string) {
  return this.prisma.contact.findMany({
    where: { tenantId }
  });
}
```

**Regra**: Se é um dado de negócio, precisa de `tenantId`.

### 3. DTOs e Validação

```typescript
// ✅ Sempre use class-validator
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateContactDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  phone?: string;
}
```

### 4. Prisma Schema

**Localização**: `packages/database/prisma/schema.prisma`

```prisma
// ✅ Sempre adicione tenantId
model Contact {
  id        String   @id @default(cuid())
  tenantId  String   // Multi-tenancy
  name      String
  email     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant    Tenant   @relation(fields: [tenantId], references: [id])
}
```

**Regra**: Após editar schema:
1. `npx prisma migrate dev --name <description>`
2. Comitar para git
3. Aplicar em produção: `npx prisma migrate deploy`

## 🤖 Sistema de Skills (IA)

### Como Funcionam

- **Skills SYSTEM**: Vêm com o produto (triagem, cobrança, agenda, análise processual)
- **Skills CUSTOM**: Criadas por cada cliente, configuráveis via UI

### Quando Sugerir Novo Skill

Se uma feature envolve IA/análise de texto:
- ✅ Crie como skill em vez de endpoint normal
- ✅ Use o playground `DrX-Claw` para testar
- ✅ Configure triggers (automático/manual)
- ✅ Defina governança (SYSTEM/CUSTOM)

### Exemplo: Adicionar Nova Skill

```
1. Defina em: src/agent/skills/
2. Registre em: src/agent/agent.service.ts
3. Configure UI em: apps/web/components/skills/
4. Teste em: Configurações > Skills > Playground
```

## 📞 Integrações Esperadas

### WhatsApp (Evolution API)

- **Arquivo**: `src/connections/evolution/`
- **Config**: `.env` com `EVO_API_KEY`, `EVO_SERVER_URL`, `EVO_WEBHOOK_URL`
- **Padrão**: Webhook → NestJS Service → Redis Queue → Processamento

**Quando localhost**:
- Evolution (Docker): http://localhost:8080
- Webhook para Evolution: http://host.docker.internal:3000/api/evolution/webhook

**Quando em produção**:
- Evolution (Docker): http://evolution:8080
- Webhook: http://api:3000/api/evolution/webhook

### Microsoft 365 (Office Integração)

- **Arquivo**: `src/connections/microsoft/`
- **Tokens**: Armazenados em DB criptografado
- **Uso**: Sync de calendário, documentos

### OpenAI (Análise & Sugestões)

- **Arquivo**: `src/agent/openai/`
- **Config**: `.env` com `OPENAI_API_KEY`
- **Padrão**: Prompt → OpenAI → Estruturado em skill

## 🔄 Fluxos Principais (Quando Claude Precisar Modificar)

### Fluxo 1: Importar Processo Jurídico

```
1. Cliente faz upload de PDF em Processos
   ↓
2. Backend extrai texto (FFmpeg + Jimp)
   ↓
3. Prisma cria Process, Party, Document records
   ↓
4. Dispara Skill: `processo-eletronico-pje-eproc`
   ↓
5. DrX-Claw (OpenAI) analisa e retorna resumo
   ↓
6. Update DB com análise, notifica via WebSocket
```

**Arquivos envolvidos**:
- Controller: `src/documents/documents.controller.ts`
- Service: `src/documents/documents.service.ts`
- Skill: `src/agent/skills/processo-eletronico-pje-eproc/`

### Fluxo 2: Mensagem WhatsApp Recebida

```
1. Evolution API envia webhook para /api/evolution/webhook
   ↓
2. WebhookController valida e parseia
   ↓
3. Communications service salva em DB
   ↓
4. Emite evento WebSocket para UI (Kanban atualiza)
   ↓
5. Se tem trigger, dispara Skill automática
   ↓
6. Skill processa e pode gerar resposta automática
```

**Arquivos envolvidos**:
- Controller: `src/connections/evolution/evolution.controller.ts`
- Service: `src/communications/communications.service.ts`
- Skill trigger logic: `src/agent/agent.service.ts`

### Fluxo 3: Criar Nova Skill

```
1. Define em src/agent/skills/[skill-name]/
2. Implementa execute() method
3. Registra em SkillRegistry
4. Configura trigger (manual/automático)
5. Testa em Playground (UI)
6. Define como SYSTEM ou CUSTOM
7. Users podem usar via Settings > Skills
```

## 📦 Desenvolvimento Local vs Produção

### Para Desenvolver

```bash
# Terminal 1: Suba infraestrutura
docker-compose up -d

# Terminal 2: Rode aplicações com hot-reload
npm run dev
```

- API roda em `localhost:3000` com hot-reload
- Web roda em `localhost:5173` com Vite
- Logs aparecem no terminal

### Para Deployar

```bash
# Versionamento automático
npm run version:bump

# Git push dispara GitHub Actions
git push origin main

# Workflow deploya para VPS automaticamente
# (veja .github/workflows/)
```

### Conectividade por Ambiente

**Local**:
- App → DB: `localhost:5432`
- App → Redis: `localhost:6379`
- App → Evolution: `localhost:8080`
- Evolution → App: `http://host.docker.internal:3000`

**Produção**:
- Todos na rede interna Docker (`drx_net_prod`)
- App → DB: `db:5432`
- App → Redis: `redis:6379`
- App → Evolution: `http://evolution:8080`

## ⚠️ "Gotchas" Comuns (Erros que Claude Deve Evitar)

### 1. Esqueceu de `tenantId`

```typescript
// ❌ BUG: Retorna dados de TODOS os tenants
const contacts = await prisma.contact.findMany();

// ✅ CORRETO
const contacts = await prisma.contact.findMany({
  where: { tenantId: req.user.tenantId }
});
```

### 2. Deletou skill SYSTEM

```
❌ Skill `triagem-juridica` foi deletada do banco
✅ Pause a skill em vez de deletar:
   UPDATE skills SET active = false WHERE id = 'triagem-juridica'
```

### 3. Editou schema sem migração

```
❌ Adicionou coluna a Contact, mas não rodou:
   npx prisma migrate dev
✅ SEMPRE faça:
   1. Edite schema.prisma
   2. npx prisma migrate dev --name add_phone_to_contact
   3. Comite a pasta migrations/
```

### 4. Testou localmente com base de dados de produção

```
❌ docker-compose aponta para DB de PROD
✅ Certifique-se:
   DATABASE_URL="postgresql://drx_dev:...@localhost:5432/drx_local"
```

### 5. Evoluó API sem considerar mobile/extension

```
❌ Mudou response format de /api/contacts
✅ Se é breaking change:
   1. Versione endpoint: /api/v2/contacts
   2. Mantenha /api/v1 por 1 release
   3. Documente migration
```

## 🔐 Boas Práticas Que Claude Deve Respeitar

1. **Autenticação**: Use JWT + Passport. Não crie outra forma.
2. **Validação**: Use `class-validator` em DTOs.
3. **Logs**: Use `Logger` do NestJS (Pino internally).
4. **Errors**: Use `HttpException` ou `BadRequestException`.
5. **Async**: Use `async/await`. Evite `.then()`.
6. **Naming**: camelCase em TS, snake_case em DB.
7. **Commits**: Mensagens claras: `feat:`, `fix:`, `chore:`
8. **Tests**: Escreva testes para lógica crítica (services).

## 📞 Como Solicitar Ajuda do Claude Efetivamente

**BOM**:
```
Implemente um novo skill chamado "analise-risco-juridico" que:
- Receba um texto de processo
- Analise usando OpenAI
- Retorne JSON com {risco: high/medium/low, justificativa: string}
- Siga o padrão do skill processo-eletronico-pje-eproc
```

**RUIM**:
```
Crie um novo skill
```

**EXCELENTE**:
```
Estenda o módulo `contacts/` para suportar:
- CPF/CNPJ validation
- Busca em base de dados pública
- Tratamento de duplicatas

Siga o padrão existente em services/controllers/dtos.
Sempre filtrar por tenantId.
Teste localmente com docker-compose.
```

## 📊 Checklist para Código Novo

Antes de pedir para Claude fazer algo, ou ao revisar o que ele fez:

- [ ] Multi-tenancy: Código respeitou `tenantId`?
- [ ] DTOs: Usou `class-validator`?
- [ ] Service/Controller: Lógica em Service?
- [ ] Erro: Retorna `HttpException` apropriada?
- [ ] Async: Usa `async/await`?
- [ ] Teste: Há testes unitários para lógica crítica?
- [ ] Documentação: Comentou funções complexas?
- [ ] Migrações: Se alterou schema, rodou migration?
- [ ] Commits: Mensagens claras com `feat:`/`fix:`?
- [ ] Breaking Changes: Se houver, documentou migration?

## 📚 Referências Rápidas

- **NestJS Docs**: https://docs.nestjs.com
- **Prisma Docs**: https://www.prisma.io/docs
- **React Docs**: https://react.dev
- **Arquivo de Skills**: `DRX_SKILLS.md` (este repo)
- **Arquitetura**: `ARCHITECTURE.md` (este repo)
- **ER Diagram**: (TODO - não existe ainda)

---

**Última atualização**: 3 de Abril de 2026
**Mantido por**: DR.X Team
```

---

## PARTE 2: Criar `PADROES_DESENVOLVIMENTO.md`

```bash
touch PADROES_DESENVOLVIMENTO.md
```

### Conteúdo

[Vou criar isto em seguida]

---

## PARTE 3: Criar `CUIDADOS_COMUNS.md`

```bash
touch CUIDADOS_COMUNS.md
```

### Conteúdo

```markdown
# ⚠️ Cuidados Comuns - Xjur

Erros frequentes que Claude (ou você) pode cometer:

## 🔴 CRÍTICO

### 1. Multi-tenancy Bypass
**Problema**: Query retorna dados de TODOS os tenants
**Causa**: Esqueceu `tenantId` no where clause
**Solução**: Sempre adicione `where: { tenantId }`
**Severidade**: CRÍTICO (data leak)

### 2. Skills SYSTEM Deletadas
**Problema**: `triagem-juridica` ou outra skill built-in foi removida
**Causa**: DELETE em vez de UPDATE active = false
**Solução**: Sempre PAUSE, nunca DELETE
**Severidade**: CRÍTICO (produto quebrado)

### 3. Schema Sem Migração
**Problema**: Adicionou coluna ao schema.prisma mas não rodou migration
**Causa**: Pressão por velocidade
**Solução**: Sempre rodar `npx prisma migrate dev`
**Severidade**: ALTO (DB out of sync)

---

## 🟠 ALTO

### 4. Breaking API Changes
**Problema**: Mudou response format de `/api/contacts` sem deprecation
**Causa**: Didn't consider mobile/extension clients
**Solução**: Use versionamento (`/api/v2/`) ou backward compatibility
**Severidade**: ALTO (clientes quebram)

### 5. Localhost Apontando para Prod DB
**Problema**: Desenvolvedor testando com DATABASE_URL de produção
**Causa**: Copy-paste errado de `.env`
**Solução**: Sempre usar `DATABASE_URL=...@localhost:5432/drx_local`
**Severidade**: ALTO (data corruption risk)

### 6. Evolution Webhook URL Errada
**Problema**: Evolution não consegue alcançar callback em localhost
**Causa**: Não usar `host.docker.internal` na dev
**Solução**: LOCAL: `http://host.docker.internal:3000` | PROD: `http://api:3000`
**Severidade**: ALTO (WhatsApp não integra)

---

## 🟡 MÉDIO

### 7. Sem Testes para Lógica Crítica
**Problema**: Skill novo nem compilado, com testes
**Causa**: Pressa
**Solução**: `npm run test` deve rodar sem erros
**Severidade**: MÉDIO (bugs em produção)

### 8. Mensagens de Commit Ruins
**Problema**: "fix stuff", "update", "wip"
**Causa**: Falta de padrão
**Solução**: Use `feat:`, `fix:`, `chore:`, `test:`
**Severidade**: MÉDIO (histórico ilegível)

### 9. Não Documentou Breaking Change
**Problema**: Novo skill muda como dados são salvos, mas nobody knows
**Causa**: Falta de comunicação
**Solução**: Documente em PR, changelog, Slack
**Severidade**: MÉDIO (confusão operacional)

---

## 🔵 BAIXO

### 10. Nomes com WRONG Conventions
**Problema**: `snake_case` em TypeScript, `camelCase` em DB
**Causa**: Copy-paste de outros projetos
**Solução**: TS = camelCase | DB = snake_case
**Severidade**: BAIXO (inconsistência estética)

---

**Checklist antes de cada PR**:
- [ ] Testei localmente com `docker-compose up`?
- [ ] `tenantId` em todas queries de dados?
- [ ] Skill SYSTEM não foi deletada?
- [ ] Rodei `npx prisma migrate dev`?
- [ ] Escrevi testes?
- [ ] Mensagem de commit clara?
- [ ] Documentei breaking changes?
```

---

## PARTE 4: Adicionar ao `.gitignore` (Opcional)

Certifique-se de que `.claude.md`, `PADROES_DESENVOLVIMENTO.md` etc. estão commitados ao git:

```bash
# Estes DEVEM ser commitados (documentação compartilhada)
# Não adicione ao .gitignore
```

---

## PARTE 5: Próxima Ação

Depois de implementar os 3 arquivos acima:

1. **Commit**:
   ```bash
   git add .claude.md PADROES_DESENVOLVIMENTO.md CUIDADOS_COMUNS.md
   git commit -m "docs: add comprehensive Claude instruction guides"
   git push
   ```

2. **Na próxima sessão Claude**:
   - Claude terá `.claude.md` no contexto
   - Poderá fazer sugestões muito mais relevantes
   - Evitará erros comuns

3. **Revisar periodicamente**:
   - A cada major release, atualize as instruções
   - Documente novos padrões descobertos

---

## Estimativa de Tempo

- ✅ `.claude.md`: 30 minutos
- ✅ `PADROES_DESENVOLVIMENTO.md`: 45 minutos
- ✅ `CUIDADOS_COMUNS.md`: 30 minutos
- ✅ Review + commit: 15 minutos

**Total**: ~2 horas

**ROI**: Economizará >10 horas de debugging + sessões Claude mais produtivas

---

**Recomendação**: Implemente isto ANTES da próxima sessão de desenvolvimento.

Seu feedback para Claude será **muito** mais eficiente.
