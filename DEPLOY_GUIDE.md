# 🚀 GUIA RÁPIDO DE DEPLOY - Módulo de Contatos V2

## ⚡ Comandos Essenciais (Copiar e Colar)

### 1️⃣ Conectar na VPS
```bash
ssh root@185.202.223.115
```
**Senha:** `Cti3132189500`

---

### 2️⃣ Verificar Status do Deploy (GitHub Actions)
```bash
cd /www/wwwroot/DrX
git pull origin main
pm2 logs --lines 50
```

---

### 3️⃣ Instalar Dependência Axios (OBRIGATÓRIO)
```bash
cd /www/wwwroot/DrX
npm install axios
```

---

### 4️⃣ Aplicar Migration do Banco de Dados (CRÍTICO)
```bash
cd /www/wwwroot/DrX/packages/database
npx prisma migrate deploy
npx prisma generate
```

**Saída esperada:**
```
✔ Generated Prisma Client
✔ Applied migration: 20260127_add_contact_fields
```

---

### 5️⃣ Reiniciar Serviços
```bash
cd /www/wwwroot/DrX
pm2 restart all
pm2 logs --lines 20
```

---

### 6️⃣ Executar Testes Automatizados
```bash
cd /www/wwwroot/DrX
node test-contacts-api.js
```

**Resultado esperado:**
```
✓ POST /contacts - Criar Pessoa Física
✓ POST /contacts - Criar Pessoa Jurídica
✓ GET /contacts - Listar todos os contatos
...
Taxa de sucesso: 95%+
```

---

## 🔍 Verificação de Problemas

### Se o PM2 mostrar erros:
```bash
pm2 logs api --lines 100
```

### Se o banco de dados não conectar:
```bash
cd /www/wwwroot/DrX/packages/database
npx prisma migrate status
```

### Se a API não responder:
```bash
curl http://localhost:3000/contacts
```

---

## 🌐 URLs de Acesso

- **Frontend:** https://dr-x.xtd.com.br/contacts
- **API:** http://api.dr-x.xtd.com.br/contacts
- **Prisma Studio:** https://studio.dr-x.xtd.com.br (porta 5555)

---

## ✅ Checklist de Deploy

- [ ] Conectar na VPS
- [ ] Verificar git pull (GitHub Actions)
- [ ] Instalar axios (`npm install axios`)
- [ ] Aplicar migration (`npx prisma migrate deploy`)
- [ ] Gerar Prisma Client (`npx prisma generate`)
- [ ] Reiniciar PM2 (`pm2 restart all`)
- [ ] Executar testes (`node test-contacts-api.js`)
- [ ] Testar no frontend (https://dr-x.xtd.com.br/contacts)

---

## 🆘 Em Caso de Emergência

### Reverter para versão anterior:
```bash
cd /www/wwwroot/DrX
git log --oneline -5
git checkout <commit-anterior>
pm2 restart all
```

### Restaurar backup do formulário antigo:
```bash
cd /www/wwwroot/DrX/apps/web/src/pages/contacts
mv ContactForm.tsx ContactForm_v2.tsx
mv ContactForm_old.tsx ContactForm.tsx
pm2 restart all
```

---

## 📞 Suporte

Consultar documentação completa:
- `RELATORIO_CONTATOS_V2.md` - Relatório completo
- `CHANGELOG_CONTATOS.md` - Detalhes técnicos
- `TESTES_CONTATOS.md` - Plano de testes manual

**Fim do Guia**
