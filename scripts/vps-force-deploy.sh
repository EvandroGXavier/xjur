#!/bin/bash

set -euo pipefail

PROJECT_DIR="/www/wwwroot/DrX"

check_url() {
  local url="$1"
  local label="$2"

  echo "Verificando ${label}: ${url}"
  curl -fsS --max-time 20 "$url" >/dev/null
  echo "OK: ${label}"
}

echo "========================================="
echo "INICIANDO DEPLOY FORCADO DO DR.X"
echo "========================================="

cd "$PROJECT_DIR" || {
  echo "A pasta ${PROJECT_DIR} nao existe."
  exit 1
}

echo "1. Baixando atualizacoes do GitHub..."
git fetch --all --prune
git reset --hard origin/main
git clean -fd
DEPLOY_COMMIT=$(git rev-parse --short HEAD)
echo "Commit preparado para deploy: ${DEPLOY_COMMIT}"

echo "2. Instalando dependencias Node.js..."
npm install

echo "3. Preparando banco de dados..."
docker compose -f docker-compose.prod.yml up -d db
echo "Aguardando banco estabilizar..."
sleep 5

echo "4. Sincronizando estrutura do banco..."
export DATABASE_URL="postgresql://drx:drx_secure_pass_123@localhost:5434/drx_db?schema=public"
npx prisma db push --schema=packages/database/prisma/schema.prisma --accept-data-loss
echo "Banco atualizado com sucesso."

echo "5. Gerando artefatos do frontend..."
npx turbo run build --filter=web

echo "6. Limpando processos PM2 antigos..."
pm2 delete all 2>/dev/null || true

echo "7. Reconstruindo containers..."
export DATABASE_URL="postgresql://drx:drx_secure_pass_123@db:5432/drx_db?schema=public"
docker compose -f docker-compose.prod.yml build --no-cache api web

echo "8. Subindo ecossistema..."
docker compose -f docker-compose.prod.yml up -d --force-recreate --remove-orphans

echo "9. Validando servicos locais..."
sleep 8
check_url "http://localhost:3000/health" "API local"
check_url "http://localhost:8080" "Web local"

echo "10. Registrando a versao publicada da VPS..."
node scripts/write-deploy-state.mjs --commit "$DEPLOY_COMMIT"
echo "${DEPLOY_COMMIT}" > "${PROJECT_DIR}/.deploy-version"

echo "========================================="
echo "STATUS DOS CONTAINERS:"
echo "========================================="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "Versao implantada registrada com sucesso."
echo "DEPLOY FINALIZADO COM SUCESSO. A VPS VOLTOU A OPERAR."
