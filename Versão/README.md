# Dr.X - Inteligência Jurídica

## Visão Geral
Sistema ERP Jurídico e Comercial unificado, projetado para rodar em VPS própria sem dependências de nuvem externa.

## Estrutura do Projeto
Este projeto é um Monorepo gerenciado via `workspaces` (npm/turbo).

- **apps/api**: Backend em NestJS v10.
  - Porta Padrão: 3000
  - Principais Serviços: 
    - `TriagemService`: Lógica de IA e atendimento.
    - `StorageService`: Armazenamento local em `/uploads`.
    - `FinancialService`: Gestão de honorários.
- **apps/web**: Frontend em React + Vite.
  - Porta Padrão: 5173 (Dev) / 8080 (Prod)
  - Estilização: TailwindCSS (Tema Dr.X).
- **packages/database**: Biblioteca compartilhada do Prisma.
  - Schema unificado (`schema.prisma`) com `pgvector`.

## Configuração e Instalação

### Pré-requisitos
- Node.js v20+
- PostgreSQL com extensões `uuid-ossp` e `pgvector`.

### Instalação (VPS)
Utilize o script automatizado na raiz do projeto:
```bash
chmod +x install_drx.sh
./install_drx.sh
```

### Instalação (Local)
1. Instale as dependências: `npm install`
2. Gere o cliente Prisma: `npx prisma generate`
3. Inicie o desenvolvimento: `npm run dev`

## Documentação de Funcionalidades Principais

### Triagem Inteligente ("Dr.X Brain")
Localizada em `apps/api/src/chat/triagem.service.ts`.
- Detecta novos leads (Rascunho de Caso).
- Vincula mensagens/arquivos a timelines de processos (`linkToProcess`).
- Simula memória contextual (RAG básico).

### Armazenamento Seguro
Localizado em `apps/api/src/storage/storage.service.ts`.
- Salva arquivos estritamente na VPS.
- Estrutura: `/uploads/{companyId}/{contactId}/{processoId}/`.
