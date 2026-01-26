#!/bin/bash
# Script de Verificação de Ambiente - Dr.X
# Este script verifica se o ambiente está configurado corretamente

set -e

echo "=========================================="
echo "  DR.X - VERIFICAÇÃO DE AMBIENTE"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar status
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

# Função para avisos
warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Verificar Node.js
echo "1. Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_status "Node.js instalado: $NODE_VERSION"
    
    # Verificar se é versão 20+
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 20 ]; then
        check_status "Versão do Node.js é adequada (20+)"
    else
        warn "Versão do Node.js é inferior a 20. Recomenda-se atualizar."
    fi
else
    check_status "Node.js não encontrado"
    echo "   Instale Node.js v20+ antes de continuar"
    exit 1
fi
echo ""

# 2. Verificar PostgreSQL
echo "2. Verificando PostgreSQL..."
if command -v psql &> /dev/null; then
    PSQL_VERSION=$(psql --version)
    check_status "PostgreSQL instalado: $PSQL_VERSION"
else
    check_status "PostgreSQL não encontrado"
    echo "   Instale PostgreSQL antes de continuar"
    exit 1
fi

# Verificar se o serviço está rodando
if systemctl is-active --quiet postgresql; then
    check_status "Serviço PostgreSQL está rodando"
else
    warn "Serviço PostgreSQL não está rodando"
    echo "   Execute: sudo systemctl start postgresql"
fi
echo ""

# 3. Verificar extensão pgvector
echo "3. Verificando extensão pgvector..."
if [ -f "/usr/share/postgresql/14/extension/vector.control" ] || \
   [ -f "/usr/share/postgresql/15/extension/vector.control" ] || \
   [ -f "/usr/share/postgresql/16/extension/vector.control" ]; then
    check_status "Extensão pgvector está instalada"
else
    warn "Extensão pgvector não encontrada"
    echo "   A extensão pgvector é necessária para o sistema funcionar"
    echo "   Execute o script install_drx.sh para instalar"
fi
echo ""

# 4. Verificar arquivo .env
echo "4. Verificando configuração de ambiente..."
if [ -f ".env" ]; then
    check_status "Arquivo .env existe na raiz do projeto"
    
    # Verificar se DATABASE_URL está definida
    if grep -q "DATABASE_URL" .env; then
        check_status "DATABASE_URL está definida no .env"
    else
        warn "DATABASE_URL não encontrada no .env"
        echo "   Adicione a variável DATABASE_URL ao arquivo .env"
    fi
else
    warn "Arquivo .env não encontrado na raiz do projeto"
    echo "   Copie .env.example para .env e configure as credenciais"
fi

# Verificar .env no packages/database
if [ -f "packages/database/.env" ]; then
    check_status "Arquivo .env existe em packages/database/"
else
    warn "Arquivo .env não encontrado em packages/database/"
    echo "   Copie o .env da raiz para packages/database/"
fi
echo ""

# 5. Verificar dependências do projeto
echo "5. Verificando dependências do projeto..."
if [ -d "node_modules" ]; then
    check_status "Dependências instaladas (node_modules existe)"
else
    warn "Dependências não instaladas"
    echo "   Execute: npm install"
fi
echo ""

# 6. Verificar Prisma Client
echo "6. Verificando Prisma Client..."
if [ -d "node_modules/@prisma/client" ]; then
    check_status "Prisma Client está instalado"
    
    # Verificar se foi gerado
    if [ -f "node_modules/@prisma/client/index.js" ]; then
        check_status "Prisma Client foi gerado"
    else
        warn "Prisma Client não foi gerado"
        echo "   Execute: npx prisma generate"
    fi
else
    warn "Prisma Client não está instalado"
    echo "   Execute: npm install"
fi
echo ""

# 7. Testar conexão com banco de dados
echo "7. Testando conexão com banco de dados..."
if [ -f ".env" ] && [ -f "packages/database/.env" ]; then
    # Extrair DATABASE_URL do .env
    source .env 2>/dev/null || true
    
    if [ -n "$DATABASE_URL" ]; then
        # Tentar conectar usando Prisma
        cd packages/database
        if npx prisma db execute --stdin <<< "SELECT 1;" &> /dev/null; then
            check_status "Conexão com banco de dados bem-sucedida"
        else
            warn "Não foi possível conectar ao banco de dados"
            echo "   Verifique as credenciais no arquivo .env"
            echo "   Verifique se o banco de dados existe"
            echo "   Verifique se o PostgreSQL está rodando"
        fi
        cd ../..
    else
        warn "DATABASE_URL não está definida"
    fi
else
    warn "Arquivos .env não encontrados, pulando teste de conexão"
fi
echo ""

# 8. Verificar se as tabelas existem
echo "8. Verificando schema do banco de dados..."
if [ -f ".env" ] && [ -n "$DATABASE_URL" ]; then
    cd packages/database
    TABLE_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tail -1 || echo "0")
    
    if [ "$TABLE_COUNT" -gt 0 ] 2>/dev/null; then
        check_status "Schema do banco de dados está configurado ($TABLE_COUNT tabelas)"
    else
        warn "Schema do banco de dados não está configurado"
        echo "   Execute: npx prisma db push"
    fi
    cd ../..
else
    warn "Não foi possível verificar schema (DATABASE_URL não configurada)"
fi
echo ""

# Resumo final
echo "=========================================="
echo "  RESUMO DA VERIFICAÇÃO"
echo "=========================================="
echo ""
echo "Se todos os itens acima estão marcados com ✓, seu ambiente está pronto!"
echo ""
echo "Caso haja avisos (⚠), siga as instruções fornecidas para corrigir."
echo ""
echo "Para iniciar o sistema em desenvolvimento:"
echo "  npm run dev"
echo ""
echo "Para compilar e iniciar em produção:"
echo "  npm run build"
echo "  pm2 start apps/api/dist/apps/api/src/main.js --name drx-api"
echo ""
