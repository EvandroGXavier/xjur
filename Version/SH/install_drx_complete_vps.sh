#!/bin/bash
# Versão Sincronizada 1.0.1.
set -e

# DR.X - COMPLETE VPS INSTALLER
# Local de Instalação: /www/wwwroot/DrX

PROJECT_DIR="/www/wwwroot/DrX"

echo "============================================="
echo "   DR.X - INTELIGÊNCIA JURÍDICA INSTALLER (VPS)   "
echo "============================================="

# Verificar se estamos no diretório correto (ou tentar navegar)
if [ -d "$PROJECT_DIR" ]; then
    echo "Navegando para $PROJECT_DIR..."
    cd "$PROJECT_DIR"
else
    echo "AVISO: Diretório $PROJECT_DIR não encontrado."
    echo "Assumindo que o script está rodando na raiz do projeto..."
    PROJECT_DIR=$(pwd)
fi

# 1. ATUALIZAR SISTEMA
echo "[1/6] Atualizando Sistema..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. INSTALAR NODE.JS v20
echo "[2/6] Verificando/Instalando Node.js v20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js já instalado: $(node -v)"
fi

# 3. INSTALAR FERRAMENTAS GLOBAIS
echo "[3/6] Instalando PM2, Turbo e NestCLI..."
sudo npm install -g pm2 turbo @nestjs/cli

# 4. INSTALAR DEPENDÊNCIAS DO PROJETO
echo "[4/6] Instalando Dependências do Projeto..."

# 4.1 Dependências da Raiz
echo "--- Raiz ---"
npm install

# 4.2 Dependências da API (Incluindo Módulo WhatsApp)
echo "--- API (apps/api) ---"
cd apps/api
# Instalação padrão + Pacotes WhatsApp
npm install
npm install @whiskeysockets/baileys qrcode pino @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install -D @types/qrcode
cd ../..

# 4.3 Dependências da Web (Incluindo Socket.io/QRCode)
echo "--- Web (apps/web) ---"
cd apps/web
# Instalação padrão + Pacotes Chat
npm install
npm install socket.io-client qrcode.react
cd ../..

# 5. CONFIGURAÇÃO DO BANCO DE DADOS
echo "[5/6] Configurando Banco de Dados..."

# Instalar PostgreSQL se necessário
if ! command -v psql &> /dev/null; then
     sudo apt-get install -y postgresql postgresql-contrib
fi

# Instalar pgvector (se necessário)
if [ ! -d "/usr/share/postgresql/*/extension/vector.control" ] && [ ! -f "/usr/share/postgresql/*/extension/vector.control" ]; then
    echo "pgvector não detectado. Instalando..."
    sudo apt-get install -y build-essential postgresql-server-dev-all git
    cd /tmp
    rm -rf pgvector
    git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
    cd pgvector
    make
    sudo make install
    cd "$PROJECT_DIR"
fi

# Configurar Banco e Usuário (Comandos seguros que não falham se já existirem)
sudo -u postgres psql -c "CREATE USER drx WITH PASSWORD 'drx_secure_pass_123';" || true
sudo -u postgres psql -c "CREATE DATABASE drx_db OWNER drx;" || true
sudo -u postgres psql -d drx_db -c "CREATE EXTENSION IF NOT EXISTS vector;" || true

# Gerar .env se não existir
if [ ! -f packages/database/.env ]; then
    echo "Criando .env para database..."
    echo "DATABASE_URL=\"postgresql://drx:drx_secure_pass_123@localhost:5432/drx_db?schema=public\"" > packages/database/.env
fi

# Gerar Prisma Client
echo "Gerando Prisma Client..."
npx turbo run db:generate

# Push do Schema
echo "Atualizando Schema do Banco..."
npx turbo run db:push

# 6. BUILD & DEPLOY
echo "[6/6] Build e Inicialização..."

# Build do Projeto
npx turbo run build

# Configuração do PM2
pm2 delete drx-api drx-web drx-studio 2>/dev/null || true

# Iniciar API
echo "Iniciando API..."
cd apps/api
pm2 start dist/main.js --name drx-api
cd ../..

# Iniciar Web
echo "Iniciando Web SPA..."
cd apps/web
pm2 serve dist 8080 --name drx-web --spa
cd ../..

# Iniciar Prisma Studio
echo "Iniciando Prisma Studio..."
cd packages/database
pm2 start "npx prisma studio --port 5555" --name drx-studio
cd ../..

# Salvar
pm2 save
pm2 startup | tail -n 1 > /dev/null 2>&1 || true

echo "============================================="
echo "   INSTALAÇÃO CONCLUÍDA!    "
echo "============================================="
echo "Para verificar os logs: pm2 logs"
