#!/bin/bash

echo "========================================="
echo "🚀 INICIANDO DEPLOY FORÇADO DO DR.X"
echo "========================================="

# Garante que o script para se der erro
set -e

# Entra na pasta do projeto
cd /www/wwwroot/DrX || { echo "❌ A pasta /www/wwwroot/DrX não existe! Crie ela primeiro."; exit 1; }

echo "1️⃣ Baixando as atualizações do GitHub..."
git fetch --all --prune
git reset --hard origin/main
git clean -fd
DEPLOY_COMMIT=$(git rev-parse --short HEAD)
echo "📌 Commit preparado para deploy: ${DEPLOY_COMMIT}"

echo "2️⃣ Instalando ou atualizando dependências Node.js..."
npm install

echo "3️⃣ Preparando Banco de Dados..."
# Sobe o container do banco caso tenha caído ou esteja recém-criado
docker compose -f docker-compose.prod.yml up -d db
echo "⏳ Aguardando banco estabilizar..."
sleep 5

echo "4️⃣ Sincronizando Estrutura do Banco (npx prisma db push)..."
# Essa string de BD temporária conecta ao container usando localhost pela porta exposta 5434 configurada no compose
export DATABASE_URL="postgresql://drx:drx_secure_pass_123@localhost:5434/drx_db?schema=public"
npx prisma db push --schema=packages/database/prisma/schema.prisma --accept-data-loss
echo "✅ Banco atualizado com sucesso!"

echo "5️⃣ Gerando Artefatos do Frontend (Next.js)..."
# Agora o Next.js não vai quebrar tentando ler campos inexistentes no Next-Auth
npx turbo run build --filter=web

echo "6️⃣ Limpando processos PM2 antigos (se houver)..."
pm2 delete all 2>/dev/null || true

echo "7️⃣ Configurando Ambientes e Reconstruindo..."
export DATABASE_URL="postgresql://drx:drx_secure_pass_123@db:5432/drx_db?schema=public"
docker compose -f docker-compose.prod.yml build --no-cache api web

echo "8️⃣ Subindo todo o ecossistema..."
docker compose -f docker-compose.prod.yml up -d --force-recreate --remove-orphans
echo "${DEPLOY_COMMIT}" > /www/wwwroot/DrX/.deploy-version
echo "✅ Commit efetivamente implantado: ${DEPLOY_COMMIT}"

echo "========================================="
echo "📊 STATUS DOS CONTAINERS:"
echo "========================================="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "🩺 HEALTH CHECK:"
sleep 5
curl -I https://dr-x.xtd.com.br | grep "HTTP" || echo "Web: ❌ Offline"
curl -I https://api.dr-x.xtd.com.br/app | grep "HTTP" || echo "API: ❌ Offline"
echo "📌 Versão implantada registrada em /www/wwwroot/DrX/.deploy-version"

echo "🚀 DEPLOY FINALIZADO COM SUCESSO! A VPS VOLTOU A OPERAR."
