# DR.X-2026 - Guia de Infraestrutura e Troubleshooting

## 📋 Informações de Conexão VPS

### Acesso SSH Direto

```bash
# Comando SSH
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@185.202.223.115

# Credenciais
Host: 185.202.223.115
Usuário: root
Porta: 22
Senha: Cti3132189500
```

### Localização do Projeto

```bash
# Diretório raiz do projeto
/www/wwwroot/DrX

# Estrutura do projeto
/www/wwwroot/DrX/
├── apps/
│   ├── api/              # Backend NestJS (porta 3000)
│   ├── web/              # Frontend React (porta 8080)
│   └── studio/           # Studio (porta 5555)
├── packages/
│   └── database/         # Prisma ORM + PostgreSQL
└── ecosystem.config.js   # Configuração PM2
```

---

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

| Camada | Tecnologia | Porta | Status |
|--------|-----------|-------|--------|
| Frontend | React 18 + Vite + TypeScript + Tailwind | 8080 | ✅ Online |
| Backend API | NestJS (Node.js) | 3000 | ✅ Online |
| Studio | Studio App | 5555 | ✅ Online |
| Banco de Dados | PostgreSQL + Prisma ORM | 5432 | ✅ Online |
| Autenticação | JWT (NestJS Guards) | - | ✅ Ativo |
| IA Engine | LangChain + OpenAI | - | ✅ Integrado |
| Reverse Proxy | Nginx 1.24.0 | 443/80 | ✅ Online |
| Process Manager | PM2 | - | ✅ Ativo |

### Configuração Nginx

```nginx
# Arquivo: /etc/nginx/sites-available/drx

# Frontend (dr-x.xtd.com.br)
server_name dr-x.xtd.com.br;
proxy_pass http://localhost:8080;

# API (api.dr-x.xtd.com.br)
server_name api.dr-x.xtd.com.br;
proxy_pass http://localhost:3000;

# Studio (studio.dr-x.xtd.com.br)
server_name studio.dr-x.xtd.com.br;
proxy_pass http://localhost:5555;
```

---

## 🚀 Gerenciamento de Processos com PM2

### Verificar Status

```bash
# Conectar à VPS
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@185.202.223.115

# Verificar status de todos os processos
pm2 status

# Visualizar logs em tempo real
pm2 logs drx-api
pm2 logs drx-web
pm2 logs drx-studio

# Informações detalhadas de um processo
pm2 show drx-api
```

### Gerenciar Processos

```bash
# Reiniciar um processo
pm2 restart drx-api
pm2 restart drx-web
pm2 restart drx-studio

# Parar um processo
pm2 stop drx-api

# Iniciar um processo
pm2 start drx-api

# Deletar um processo
pm2 delete drx-api

# Reiniciar todos
pm2 restart all
```

### Logs de Erro

```bash
# Visualizar últimas 50 linhas de erro da API
tail -50 /root/.pm2/logs/drx-api-error.log

# Visualizar logs de saída
tail -50 /root/.pm2/logs/drx-api-out.log

# Monitorar logs em tempo real
tail -f /root/.pm2/logs/drx-api-error.log
```

---

## 🔧 Build e Deploy

### Estrutura de Build

O projeto usa **Turbo** para build monorepo:

```bash
# Navegar para o diretório do projeto
cd /www/wwwroot/DrX

# Build completo (recompila todas as aplicações)
npm run build

# Build sem cache (força recompilação)
npm run build -- --no-cache

# Limpar cache do Turbo
rm -rf .turbo

# Build específico de um app
cd apps/api && npm run build
```

### Estrutura de Compilação

```
Turbo Build Pipeline:
├── @drx/database:build    → Compila Prisma ORM
├── api:build              → Compila NestJS (usa @drx/database)
└── web:build              → Compila React + Vite

Outputs:
├── packages/database/dist/
├── apps/api/dist/
└── apps/web/dist/
```

### GitHub Actions

O projeto tem **GitHub Action** configurado para:
- Fazer build automaticamente ao fazer commit
- Atualizar a VPS automaticamente após build bem-sucedido
- Repositório: `EvandroGXavier/xjur`

---

## ⚠️ Problemas Comuns e Soluções

### Problema 1: Erro 502 Bad Gateway

**Sintomas:**
- Site retorna `502 Bad Gateway`
- Nginx não consegue conectar aos backends

**Causas Possíveis:**
1. Aplicação não está rodando (verifique PM2 status)
2. Porta incorreta na configuração Nginx
3. Aplicação caiu por erro de inicialização

**Solução:**

```bash
# 1. Verificar status
pm2 status

# 2. Verificar logs de erro
tail -50 /root/.pm2/logs/drx-api-error.log
tail -50 /root/.pm2/logs/drx-web-out.log

# 3. Reiniciar o processo
pm2 restart drx-api
pm2 restart drx-web

# 4. Verificar portas abertas
netstat -tlnp | grep node

# 5. Testar conectividade
curl -k https://dr-x.xtd.com.br/
```

### Problema 2: API Caindo Constantemente

**Sintomas:**
- Status do PM2 mostra `errored`
- Múltiplas reinicializações (↺ > 10)

**Causas Possíveis:**
1. Erro de import/módulo não encontrado
2. Variáveis de ambiente faltando
3. Banco de dados desconectado
4. Arquivo compilado corrompido

**Solução:**

```bash
# 1. Verificar logs detalhados
tail -100 /root/.pm2/logs/drx-api-error.log

# 2. Limpar cache de compilação
cd /www/wwwroot/DrX
rm -rf .turbo
rm -rf apps/api/dist
rm -rf packages/database/dist

# 3. Reconstruir
npm run build

# 4. Reiniciar
pm2 restart drx-api

# 5. Monitorar
pm2 logs drx-api
```

### Problema 3: Erro de Módulo TypeScript em Produção

**Sintomas:**
```
Error: Cannot find module '../../../packages/database/src/index.ts'
```

**Causa:**
- Arquivo compilado está importando `.ts` em vez de `.js`
- Path alias não foi resolvido corretamente

**Solução:**

```bash
# 1. Verificar arquivo compilado
grep 'database' /www/wwwroot/DrX/apps/api/dist/app.module.js

# 2. Se mostrar '.ts', o build está errado
# Limpar e reconstruir com Nest CLI diretamente
cd /www/wwwroot/DrX/apps/api
rm -rf dist
npx @nestjs/cli build

# 3. Reiniciar
pm2 restart drx-api
```

### Problema 4: Processo Online mas Sem PID

**Sintomas:**
- PM2 status mostra `online` mas PID é `N/A`
- Porta não está sendo escutada

**Solução:**

```bash
# Reiniciar o processo
pm2 restart drx-web

# Verificar se porta está sendo escutada
netstat -tlnp | grep 8080

# Se não aparecer, verificar logs
tail -50 /root/.pm2/logs/drx-web-error.log
```

---

## 🔍 Verificações de Saúde

### Checklist de Funcionamento

```bash
# 1. Verificar status dos processos
pm2 status

# 2. Verificar portas abertas
netstat -tlnp | grep node

# 3. Testar conectividade da API
curl -k https://api.dr-x.xtd.com.br/health

# 4. Testar conectividade do site
curl -k https://dr-x.xtd.com.br/

# 5. Verificar logs de erro do Nginx
tail -20 /var/log/nginx/error.log

# 6. Verificar espaço em disco
df -h

# 7. Verificar uso de memória
free -h

# 8. Verificar uptime
uptime
```

### Testes Rápidos

```bash
# Testar API
curl -k https://api.dr-x.xtd.com.br/

# Testar Frontend
curl -k https://dr-x.xtd.com.br/ | head -20

# Testar Studio
curl -k https://studio.dr-x.xtd.com.br/ | head -20

# Testar Nginx
nginx -t
```

---

## 📝 Variáveis de Ambiente

### Arquivo .env (API)

```bash
# Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/drx

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=7d

# OpenAI / LangChain
OPENAI_API_KEY=sk-...

# Porta
PORT=3000

# Environment
NODE_ENV=production
```

### Verificar Variáveis

```bash
# Verificar se variáveis estão carregadas
pm2 show drx-api | grep env
```

---

## 🔐 Segurança e Backup

### Backup do Projeto

```bash
# Fazer backup do projeto
tar -czf /backup/drx-$(date +%Y%m%d).tar.gz /www/wwwroot/DrX

# Fazer backup do banco de dados
pg_dump drx > /backup/drx-db-$(date +%Y%m%d).sql
```

### Monitorar Espaço

```bash
# Verificar uso de disco
du -sh /www/wwwroot/DrX

# Limpar cache de node_modules (se necessário)
cd /www/wwwroot/DrX
rm -rf node_modules
npm install
```

---

## 📞 Contato e Suporte

### Informações do Projeto

- **Repositório GitHub**: `EvandroGXavier/xjur`
- **Domínio Principal**: `dr-x.xtd.com.br`
- **API**: `api.dr-x.xtd.com.br`
- **Studio**: `studio.dr-x.xtd.com.br`
- **VPS IP**: `185.202.223.115`

### Próximos Passos em Caso de Erro

1. Verificar PM2 status
2. Verificar logs de erro
3. Limpar cache e reconstruir
4. Reiniciar processos
5. Verificar conectividade Nginx
6. Consultar este guia

---

## 📚 Referências Rápidas

### Comandos Essenciais

```bash
# Conectar à VPS
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@185.202.223.115

# Navegar para projeto
cd /www/wwwroot/DrX

# Ver status
pm2 status

# Ver logs
pm2 logs drx-api

# Reconstruir
npm run build

# Reiniciar tudo
pm2 restart all

# Testar site
curl -k https://dr-x.xtd.com.br/
```

---

**Última atualização**: 23 de Janeiro de 2026  
**Versão**: 1.0  
**Status**: ✅ Produção
