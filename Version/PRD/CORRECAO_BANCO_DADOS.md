# Correção do Problema de Conexão com Banco de Dados

## Problema Identificado

O sistema **Dr.X (XJUR)** não estava gravando contatos no banco de dados devido a problemas de configuração e falta de extensões necessárias do PostgreSQL.

## Causas Raiz Identificadas

### 1. **Arquivo .env Ausente ou Mal Configurado**

O sistema utiliza Prisma ORM para gerenciar o banco de dados, e ele depende da variável de ambiente `DATABASE_URL` para conectar ao PostgreSQL. Existem dois locais onde este arquivo é necessário:

- **Raiz do projeto**: `/xjur/.env`
- **Pacote database**: `/xjur/packages/database/.env`

**Sintoma**: Quando o arquivo `.env` não existe ou a variável `DATABASE_URL` não está configurada, o Prisma não consegue conectar ao banco de dados, resultando em falhas silenciosas ao tentar salvar dados.

### 2. **Extensão pgvector Não Instalada**

O schema do Prisma (`packages/database/prisma/schema.prisma`) declara a necessidade da extensão `pgvector` do PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [pgvector(map: "vector"), uuid_ossp(map: "uuid-ossp")]
}
```

**Sintoma**: Ao tentar aplicar o schema com `npx prisma db push`, o sistema retorna erro:

```
ERROR: could not open extension control file "/usr/share/postgresql/14/extension/vector.control": No such file or directory
```

### 3. **Schema do Banco de Dados Não Aplicado**

Mesmo com o banco de dados e extensões instalados, se o comando `npx prisma db push` não foi executado, as tabelas não existem no banco de dados.

**Sintoma**: Tentativas de inserir dados resultam em erros como "relation 'contacts' does not exist".

### 4. **Prisma Client Não Gerado**

O Prisma Client precisa ser gerado após qualquer alteração no schema para que o código TypeScript possa interagir com o banco de dados.

**Sintoma**: Erros de compilação ou runtime relacionados a tipos não encontrados do Prisma.

---

## Solução Completa

### Passo 1: Verificar e Instalar PostgreSQL

Certifique-se de que o PostgreSQL está instalado e rodando:

```bash
# Verificar se está instalado
psql --version

# Verificar se está rodando
sudo systemctl status postgresql

# Se não estiver rodando, inicie
sudo systemctl start postgresql

# Habilitar para iniciar automaticamente
sudo systemctl enable postgresql
```

### Passo 2: Instalar a Extensão pgvector

A extensão pgvector precisa ser compilada e instalada manualmente:

```bash
# Instalar dependências de compilação
sudo apt-get update
sudo apt-get install -y build-essential postgresql-server-dev-all git

# Clonar e compilar pgvector
cd /tmp
rm -rf pgvector
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Verificar instalação
ls /usr/share/postgresql/*/extension/vector.control
```

### Passo 3: Criar e Configurar o Banco de Dados

```bash
# Criar usuário e banco de dados (ajuste as credenciais conforme necessário)
sudo -u postgres psql << EOF
CREATE USER drx WITH PASSWORD 'drx_secure_pass_123';
CREATE DATABASE drx_db OWNER drx;
\c drx_db
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
```

### Passo 4: Configurar Variáveis de Ambiente

```bash
# Na raiz do projeto
cd /path/to/xjur

# Criar arquivo .env na raiz
cat > .env << 'EOF'
DATABASE_URL="postgresql://drx:drx_secure_pass_123@localhost:5432/drx_db?schema=public"
EOF

# Copiar para o pacote database
cp .env packages/database/.env
```

**IMPORTANTE**: Ajuste as credenciais (`drx`, `drx_secure_pass_123`, `drx_db`) conforme seu ambiente.

### Passo 5: Instalar Dependências do Projeto

```bash
# Na raiz do projeto
npm install
```

### Passo 6: Gerar Prisma Client

```bash
# Gerar o cliente Prisma
cd packages/database
npx prisma generate
cd ../..
```

### Passo 7: Aplicar Schema ao Banco de Dados

```bash
# Aplicar o schema (criar tabelas)
cd packages/database
npx prisma db push
cd ../..
```

**Saída esperada**:
```
✔ Your database is now in sync with your Prisma schema.
```

### Passo 8: Compilar o Projeto

```bash
# Compilar o pacote database
cd packages/database
npm run build
cd ../..

# Compilar a API
cd apps/api
npm run build
cd ../..
```

### Passo 9: Verificar a Instalação

Execute o script de verificação criado:

```bash
./check-environment.sh
```

Este script verificará todos os componentes e indicará se há algum problema pendente.

### Passo 10: Testar o Sistema

#### Opção A: Modo Desenvolvimento

```bash
npm run dev
```

#### Opção B: Modo Produção

```bash
# Iniciar API com PM2
pm2 start apps/api/dist/apps/api/src/main.js --name drx-api

# Verificar logs
pm2 logs drx-api
```

#### Testar Endpoint de Contatos

```bash
# Criar um contato de teste
curl -X POST http://localhost:3000/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste Contato",
    "email": "teste@example.com",
    "phone": "11999999999"
  }'

# Listar contatos
curl http://localhost:3000/contacts
```

**Resposta esperada**: JSON com os dados do contato criado, incluindo um `id` UUID.

---

## Verificação de Sucesso

Para confirmar que o problema foi resolvido:

1. **Verificar se o contato foi salvo no banco**:

```bash
sudo -u postgres psql -d drx_db -c "SELECT id, name, email, phone FROM contacts;"
```

2. **Verificar logs da API**:

```bash
pm2 logs drx-api
# ou se rodando em dev:
# Verificar o terminal onde executou npm run dev
```

3. **Testar via interface web** (se disponível):
   - Acesse o frontend
   - Cadastre um novo contato
   - Verifique se aparece na listagem
   - Recarregue a página e confirme que o contato persiste

---

## Problemas Comuns e Soluções

### Erro: "Authentication failed against database server"

**Causa**: Credenciais incorretas no `DATABASE_URL`.

**Solução**:
1. Verifique o usuário e senha no PostgreSQL
2. Atualize o arquivo `.env` com as credenciais corretas
3. Certifique-se de que o método de autenticação está configurado corretamente em `/etc/postgresql/*/main/pg_hba.conf`

### Erro: "database does not exist"

**Causa**: O banco de dados especificado na `DATABASE_URL` não foi criado.

**Solução**:
```bash
sudo -u postgres psql -c "CREATE DATABASE drx_db;"
```

### Erro: "extension 'vector' does not exist"

**Causa**: A extensão pgvector não está instalada ou não foi habilitada no banco.

**Solução**:
```bash
# Reinstalar pgvector (ver Passo 2)
# Depois habilitar no banco:
sudo -u postgres psql -d drx_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Erro: "relation 'contacts' does not exist"

**Causa**: O schema não foi aplicado ao banco de dados.

**Solução**:
```bash
cd packages/database
npx prisma db push
```

### Erro: "Cannot find module '@prisma/client'"

**Causa**: O Prisma Client não foi gerado.

**Solução**:
```bash
cd packages/database
npx prisma generate
```

---

## Prevenção de Problemas Futuros

### 1. Adicionar Validação de Ambiente

Adicione o script `check-environment.sh` ao processo de deploy e execute-o antes de iniciar o sistema.

### 2. Documentar Variáveis de Ambiente

Mantenha o arquivo `.env.example` atualizado com todas as variáveis necessárias e suas descrições.

### 3. Automatizar Setup

O script `install_drx.sh` já contém a maioria das etapas necessárias. Certifique-se de executá-lo em servidores novos.

### 4. Monitoramento de Logs

Configure alertas para erros de banco de dados:

```bash
# Adicionar ao PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 5. Backup Regular

Configure backups automáticos do PostgreSQL:

```bash
# Criar script de backup
cat > /usr/local/bin/backup-drx-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/drx"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump drx_db | gzip > $BACKUP_DIR/drx_db_$DATE.sql.gz
# Manter apenas últimos 7 dias
find $BACKUP_DIR -name "drx_db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-drx-db.sh

# Adicionar ao cron (diário às 2h da manhã)
echo "0 2 * * * /usr/local/bin/backup-drx-db.sh" | sudo crontab -
```

---

## Checklist para Deploy em Novo Servidor

- [ ] PostgreSQL instalado e rodando
- [ ] Extensão pgvector instalada
- [ ] Banco de dados criado
- [ ] Extensões vector e uuid-ossp habilitadas no banco
- [ ] Arquivo `.env` configurado na raiz do projeto
- [ ] Arquivo `.env` copiado para `packages/database/`
- [ ] Dependências instaladas (`npm install`)
- [ ] Prisma Client gerado (`npx prisma generate`)
- [ ] Schema aplicado ao banco (`npx prisma db push`)
- [ ] Projeto compilado (`npm run build`)
- [ ] Script de verificação executado (`./check-environment.sh`)
- [ ] Serviços iniciados com PM2
- [ ] Teste de criação de contato realizado com sucesso
- [ ] Nginx configurado (se aplicável)
- [ ] SSL/HTTPS configurado (se aplicável)
- [ ] Backup automático configurado

---

## Contato e Suporte

Para problemas adicionais ou dúvidas sobre a configuração, consulte:

- **Documentação do Prisma**: https://www.prisma.io/docs
- **Documentação do pgvector**: https://github.com/pgvector/pgvector
- **Documentação do NestJS**: https://docs.nestjs.com

---

**Última atualização**: 23 de janeiro de 2026
