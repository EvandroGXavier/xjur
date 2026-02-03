#!/bin/bash
set -e

# DR.X INSTALLER SCRIPT
# Runs on Ubuntu 20.04/22.04 LTS

echo "============================================="
echo "   DR.X - INTELIGÊNCIA JURÍDICA INSTALLER    "
echo "============================================="

# 1. ATUALIZAR SISTEMA
echo "[1/5] Atualizando Sistema..."
sudo apt-get update && sudo apt-get upgrade -y

# 2. INSTALAR NODE.JS v20 (OBRIGATÓRIO)
echo "[2/5] Instalando Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v

# 3. INSTALAR FERRAMENTAS GLOBAIS
echo "[3/5] Instalando PM2 e ferramentas de build..."
sudo npm install -g pm2 turbo @nestjs/cli

# 4. CONFIGURAÇÃO DO BANCO DE DADOS (POSTGRESQL + PGVECTOR)
echo "[4/5] Configurando PostgreSQL..."

# Verificar se PostgreSQL já está instalado
if systemctl is-active --quiet postgresql; then
    echo "PostgreSQL já está rodando. Pulando instalação."
else
    echo "Instalando PostgreSQL..."
    sudo apt-get install -y postgresql postgresql-contrib
fi

# Configurar Banco de Dados e Usuário (Idempotente)
echo "Configurando banco de dados e usuário..."
sudo -u postgres psql -c "CREATE USER drx WITH PASSWORD 'drx_secure_pass_123';" || echo "Usuário 'drx' já existe ou erro ao criar."
sudo -u postgres psql -c "CREATE DATABASE drx_db OWNER drx;" || echo "Banco 'drx_db' já existe ou erro ao criar."
sudo -u postgres psql -d drx_db -c "CREATE EXTENSION IF NOT EXISTS vector;" || echo "Erro ao habilitar extensão vector (verifique se pgvector está instalado)."

# Instalação do pgvector (Necessário para a extensão 'vector')
echo "Instalando dependências para compilação..."
sudo apt-get install -y build-essential postgresql-server-dev-all git

echo "Compilando e instalando pgvector..."
# Salvar diretório atual para retorno
PROJECT_ROOT=$(pwd)

cd /tmp
rm -rf pgvector # Limpar instalações anteriores
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Retornar ao diretório do projeto
cd "$PROJECT_ROOT"

# Configurar .env automaticamente se não existir
if [ ! -f .env ]; then
    echo "Gerando arquivo .env padrão..."
    # Obter URL do banco do schema.prisma ou usar padrão
    # Por simplicidade, usando o padrão definido no topo, que deve bater com o docker/serviço
    # Se pgvector for necessário na URL, ajustamos aqui.
    if ! grep -q "DATABASE_URL" .env 2>/dev/null; then
        echo "DATABASE_URL=\"postgresql://drx:drx_secure_pass_123@localhost:5432/drx_db?schema=public\"" >> .env
    fi
    echo "Arquivo .env configurado."
else
    echo "Arquivo .env já existe. Mantendo configuração atual."
fi

# Criar turbo.json se não existir (essencial para o build)
if [ ! -f turbo.json ]; then
    echo "Criando arquivo de configuração turbo.json..."
    cat > turbo.json <<EOF
{
  "\$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    },
    "db:generate": {
       "cache": false
    },
    "db:push": {
       "cache": false
    }
  }
}
EOF
fi

# 5. BUILD & DEPLOY
echo "[5/5] Compilando Dr.X..."
# Navegar para raiz do projeto (assumido ser dir atual ou clonado)
npm install

# Gerar Prisma Client (Corrigido para usar workspace correto)
echo "Gerando Prisma Client..."
npm run db:generate -w @dr-x/database

# Ensure database tables are created
echo "Enviando schema para o banco de dados..."
npm run db:push -w @dr-x/database

# HOTFIX: Corrigir erro de lint no App.tsx se existir (import não utilizado)
if [ -f apps/web/src/App.tsx ]; then
    echo "Aplicando hotfix no App.tsx..."
    sed -i "/import { useState } from 'react'/d" apps/web/src/App.tsx
    sed -i "/import '.\/App.css';/d" apps/web/src/App.tsx
fi

npm run build

# 6. CONFIGURAR NGINX E PROXY REVERSO
echo "[6/7] Configurando Nginx e Domínios..."

# Parar serviços que podem conflitar na porta 80
echo "Verificando conflitos na porta 80..."
sudo systemctl stop apache2 2>/dev/null || true
sudo systemctl stop httpd 2>/dev/null || true

# Instalar Nginx se não estiver instalado
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Limpar configurações conflitantes
echo "Limpando configurações antigas do Nginx..."
sudo rm -f /etc/nginx/sites-enabled/default
# Remover qualquer arquivo que contenha o domínio para evitar duplicidade
for file in /etc/nginx/sites-enabled/*; do
    if grep -q "dr-x.xtd.com.br" "$file"; then
        echo "Removendo conflito: $file"
        sudo rm -f "$file"
    fi
done

# Criar nova configuração
cat << 'EOF' | sudo tee /etc/nginx/sites-available/drx
server {
    server_name dr-x.xtd.com.br;
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    server_name api.dr-x.xtd.com.br;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    server_name studio.dr-x.xtd.com.br;
    location / {
        proxy_pass http://localhost:5555;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Habilitar site
sudo ln -sf /etc/nginx/sites-available/drx /etc/nginx/sites-enabled/drx

# Testar configuração e reiniciar
echo "Testando configuração do Nginx..."
# Se houver outro processo na porta 80, o restart vai falhar
if sudo nginx -t; then
    echo "Sintaxe OK. Reiniciando Nginx..."
    sudo systemctl restart nginx || echo "AVISO: Falha ao reiniciar Nginx. Verifique se a porta 80 está livre (ex: 'sudo lsof -i :80') ou se há erros no 'journalctl -xeu nginx.service'."
else
    echo "ERRO NA SINTAXE DO NGINX. As alterações não foram aplicadas."
fi

# 7. INICIAR SERVIÇOS (PM2)
echo "[7/7] Iniciando serviços com PM2..."

# Parar processos antigos se existirem (para evitar duplicidade no script)
pm2 delete drx-api drx-web drx-studio 2>/dev/null || true

# Start API
echo "Iniciando API..."
pm2 start apps/api/dist/main.js --name drx-api

# Start Web (SPA)
echo "Iniciando Web App..."
pm2 serve apps/web/dist 8080 --name drx-web --spa

# Start Prisma Studio
echo "Iniciando Prisma Studio..."
# Necessário rodar dentro do diretório do banco ou especificar schema
pm2 start "npx prisma studio --port 5555" --name drx-studio --cwd packages/database

# Salvar lista de processos para reiniciar no boot
pm2 save
pm2 startup | tail -n 1 > /dev/null 2>&1 || echo "Execute 'pm2 startup' manualmente se necessário."

echo "============================================="
echo "   INSTALAÇÃO CONCLUÍDA COM SUCESSO!         "
echo "============================================="
echo "Seus serviços estão rodando:"
echo "1. Web App:       http://dr-x.xtd.com.br"
echo "2. API:           http://api.dr-x.xtd.com.br"
echo "3. Prisma Studio: http://studio.dr-x.xtd.com.br"
echo ""
echo "IMPORTANTE: O SSL (HTTPS) ainda não está ativo."
echo "Para ativar o HTTPS, rode o seguinte comando no servidor:"
echo ""
echo "    sudo certbot --nginx -d dr-x.xtd.com.br -d api.dr-x.xtd.com.br -d studio.dr-x.xtd.com.br"
echo ""

