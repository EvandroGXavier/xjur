# Arquitetura Unificada Dr.X (Local & VPS)

Este documento descreve a arquitetura de containers projetada para alinhar o ambiente de desenvolvimento local com o ambiente de produção (VPS), garantindo paridade e facilitando o deploy.

## 1. Visão Geral

O objetivo é manter a infraestrutura (Banco de Dados, Redis, Motor WhatsApp) rodando em Docker em ambos os ambientes, enquanto flexibilizamos a execução da aplicação (API NestJS e Frontend React) no ambiente local para desenvolvimento acelerado.

### Comparativo de Ambientes

| Componente | Função | Desenvolvimento (Local) | Produção (VPS) |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | Armazenamento de Dados + Vetores (IA) | Docker 🐳 (`drx_db_local`) | Docker 🐳 (`drx_db_prod`) |
| **Redis** | Filas de Mensagens e Cache | Docker 🐳 (`drx_redis_local`) | Docker 🐳 (`drx_redis_prod`) |
| **Evolution API** | Motor de Conexão WhatsApp | Docker 🐳 (`drx_evolution_local`) | Docker 🐳 (`drx_evolution_prod`) |
| **API (NestJS)** | Regra de Negócio | **Host** 💻 (Node.js/Hot-Reload) | Docker 🐳 (`drx_api_prod`) |
| **Web (React)** | Interface do Usuário | **Host** 💻 (Vite/Hot-Reload) | Docker 🐳 (`drx_api_web`) |

---

## 2. Detalhes de Conectividade

### Ambiente Local
No ambiente local, a **Evolution API** (dentro do Docker) precisa se comunicar com a **API NestJS** (fora do Docker).

*   **Evolution -> NestJS (Webhooks):**
    *   URL: `http://host.docker.internal:3000/api/evolution/webhook`
    *   Mecanismo: `host.docker.internal` permite que o container acesse a porta 3000 da máquina host.

*   **NestJS -> Evolution (Comandos):**
    *   URL: `http://localhost:8080`
    *   Mecanismo: A porta 8080 do container Evolution é exposta para o localhost.

### Ambiente Produção
Na VPS, todos os serviços rodam na mesma rede interna Docker (`drx_net_prod`).

*   **Evolution -> NestJS (Webhooks):**
    *   URL: `http://api:3000/api/evolution/webhook`
    *   Mecanismo: Resolução de DNS interno do Docker pelo nome do serviço (`api`).

*   **NestJS -> Evolution (Comandos):**
    *   URL: `http://evolution:8080`
    *   Mecanismo: Resolução de DNS interno do Docker pelo nome do serviço (`evolution`).

---

## 3. Comandos de Operação

### Desenvolvimento Local

1.  **Subir Infraestrutura (Banco + Redis + Evolution):**
    ```bash
    docker-compose up -d
    ```

2.  **Iniciar Aplicação (API + Web):**
    ```bash
    # Em outro terminal
    npx turbo run dev --filter=!extension
    ```

3.  **Parar Infraestrutura:**
    ```bash
    docker-compose down
    ```

### Deploy em Produção (VPS)

1.  **Subir Tudo (Infra + Apps):**
    ```bash
    docker-compose -f docker-compose.prod.yml up -d --build
    ```

2.  **Verificar Logs:**
    ```bash
    docker-compose -f docker-compose.prod.yml logs -f
    ```

---

## 4. Requisitos de Configuração (.env)

Certifique-se de que o arquivo `.env` local esteja configurado corretamente para apontar para os serviços Docker locais:

```ini
# Database
DATABASE_URL="postgresql://drx_dev:drx_local_pass@localhost:5432/drx_local"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Evolution API
EVO_API_KEY=JaJyX0tc3DvmPScDDRojSsguMSddVGeO
EVO_SERVER_URL=http://localhost:8080
EVO_WEBHOOK_URL=http://host.docker.internal:3000/api/evolution/webhook
```
