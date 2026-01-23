# 🚨 PROMPT DE REPARO - API DR.X (Erro 502 Bad Gateway)

## ⚠️ ATENÇÃO: LEIA ANTES DE FAZER QUALQUER ALTERAÇÃO NA VPS

Este documento contém instruções **CRÍTICAS** para evitar que você quebre a API do projeto DR.X novamente ao fazer alterações na VPS.

---

## 📋 Contexto do Problema

O projeto DR.X é um **monorepo Turbo** com a seguinte estrutura:

```
DrX/
├── apps/
│   ├── api/          # NestJS API
│   ├── web/          # React Frontend
│   └── studio/       # Prisma Studio
├── packages/
│   └── database/     # Módulo compartilhado do Prisma
└── turbo.json
```

### 🔴 Problema Recorrente

Quando você faz alterações no código da API e executa `npm run build`, o **Turbo Cache** pode usar versões antigas dos arquivos compilados, causando o erro:

```
Error: Cannot find module '../../../packages/database/src/index.ts'
```

Isso acontece porque:
1. O arquivo fonte (`app.module.ts`) importa corretamente: `from '../../../packages/database/dist/index.js'`
2. Mas o arquivo **compilado** (`dist/app.module.js`) ainda tem o import antigo: `require("../../../packages/database/src/index.ts")`

---

## ✅ SOLUÇÃO CORRETA (Siga SEMPRE estes passos)

### 1️⃣ **NUNCA use `npm run build` diretamente**

O comando `npm run build` usa o Turbo, que pode usar cache antigo mesmo com `--force`.

### 2️⃣ **SEMPRE use este processo de rebuild:**

```bash
# Conectar à VPS
ssh root@185.202.223.115

# Navegar até o diretório da API
cd /www/wwwroot/DrX/apps/api

# Parar a API
pm2 stop drx-api

# Deletar o diretório dist (IMPORTANTE!)
rm -rf dist

# Reconstruir APENAS a API com Nest CLI (sem Turbo)
npx @nestjs/cli build

# Reiniciar a API com o caminho correto
pm2 delete drx-api
pm2 start /www/wwwroot/DrX/apps/api/dist/main.js --name drx-api
pm2 save

# Verificar status
pm2 status
```

### 3️⃣ **Verificar se a API está funcionando**

```bash
# Aguardar 10 segundos
sleep 10

# Verificar status novamente
pm2 status

# Verificar logs de saída (deve mostrar "Nest application successfully started")
tail -20 /root/.pm2/logs/drx-api-out.log

# Verificar logs de erro (NÃO deve ter erros recentes)
tail -20 /root/.pm2/logs/drx-api-error.log
```

### 4️⃣ **Testar o site**

Acesse: https://dr-x.xtd.com.br/

Se carregar o Dashboard sem erro 502, está tudo OK! ✅

---

## 🚫 O QUE **NUNCA** FAZER

### ❌ NÃO faça isso:
```bash
npm run build                    # Usa Turbo Cache
npm run build -- --force         # Ainda usa Turbo Cache
turbo run build                  # Usa Turbo Cache
```

### ❌ NÃO altere o arquivo `app.module.ts` para:
```typescript
import { PrismaModule } from '@dr-x/database';  // ❌ ERRADO
import { PrismaModule } from '../../../packages/database/src/index.ts';  // ❌ ERRADO
```

### ✅ O import correto é:
```typescript
import { PrismaModule } from '../../../packages/database/dist/index.js';  // ✅ CORRETO
```

---

## 🔧 Configuração do PM2

O PM2 **DEVE** estar configurado para executar o arquivo compilado no caminho:

```
/www/wwwroot/DrX/apps/api/dist/main.js
```

**NÃO** use o caminho antigo:
```
/www/wwwroot/DrX/apps/api/dist/apps/api/src/main.js  # ❌ ERRADO
```

---

## 📊 Como Verificar se Está Tudo OK

### Status do PM2:
```bash
pm2 status
```

Deve mostrar:
```
┌────┬─────────────┬──────┬───────────┬──────────┐
│ id │ name        │ ↺    │ status    │ cpu      │
├────┼─────────────┼──────┼───────────┼──────────┤
│ 27 │ drx-api     │ 0    │ online    │ 0%       │
│ 2  │ drx-studio  │ 92   │ online    │ 0%       │
│ 1  │ drx-web     │ 59   │ online    │ 0%       │
└────┴─────────────┴──────┴───────────┴──────────┘
```

✅ **drx-api** deve estar com `status: online` e `↺: 0` (ou número baixo de reinicializações)

---

## 🔄 Se o Erro Voltar

Se a API voltar a ficar em estado `errored`, siga os passos da **Seção 2️⃣** novamente.

**IMPORTANTE**: Sempre delete o `dist/` antes de reconstruir!

---

## 📝 Resumo das Regras de Ouro

1. ✅ **SEMPRE** delete `dist/` antes de reconstruir
2. ✅ **SEMPRE** use `npx @nestjs/cli build` (não use `npm run build`)
3. ✅ **SEMPRE** verifique o caminho do PM2: `/www/wwwroot/DrX/apps/api/dist/main.js`
4. ✅ **SEMPRE** teste o site após reiniciar a API
5. ❌ **NUNCA** confie no Turbo Cache para rebuild de produção
6. ❌ **NUNCA** altere o import do `app.module.ts` para usar `.ts` em vez de `.js`

---

## 🆘 Se Precisar de Ajuda

Se mesmo seguindo estes passos a API continuar com erro, verifique:

1. **Arquivo fonte está correto?**
   ```bash
   cat /www/wwwroot/DrX/apps/api/src/app.module.ts | grep database
   ```
   Deve mostrar: `from '../../../packages/database/dist/index.js'`

2. **Arquivo compilado está correto?**
   ```bash
   cat /www/wwwroot/DrX/apps/api/dist/app.module.js | grep database
   ```
   Deve mostrar: `require("../../../packages/database/dist/index.js")`

3. **PM2 está usando o caminho correto?**
   ```bash
   pm2 info drx-api | grep script
   ```
   Deve mostrar: `script path: /www/wwwroot/DrX/apps/api/dist/main.js`

---

**Criado em**: 23/01/2026  
**Versão**: 1.0  
**Autor**: Manus AI (Troubleshooting DR.X)
