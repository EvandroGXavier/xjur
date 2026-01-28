# 🏢 SISTEMA DE MULTI-TENANCY - DR.X

## 📋 Visão Geral

O sistema DR.X implementa **multi-tenancy** para permitir que múltiplos escritórios/empresas (tenants) usem a mesma aplicação de forma isolada, cada um com seus próprios dados.

---

## 🔐 Como Funciona

### 1. Estrutura de Autenticação

Quando um usuário faz login, o sistema gera um **JWT (JSON Web Token)** contendo:

```json
{
  "sub": "user-id",
  "email": "usuario@email.com",
  "tenantId": "tenant-uuid",
  "role": "admin"
}
```

### 2. Extração do Tenant

O `JwtStrategy` (localizado em `apps/api/src/auth/jwt.strategy.ts`) extrai automaticamente o `tenantId` do token e injeta no objeto `request.user`:

```typescript
async validate(payload: any) {
  return { 
    userId: payload.sub, 
    email: payload.email, 
    tenantId: payload.tenantId, 
    role: payload.role 
  };
}
```

### 3. Uso nos Controllers

Os controllers usam o decorator `@CurrentUser()` para acessar os dados do usuário autenticado:

```typescript
@Post()
create(@Body() createContactDto: CreateContactDto, @CurrentUser() user: CurrentUserData) {
  return this.contactsService.create(createContactDto, user.tenantId);
}
```

### 4. Isolamento de Dados

Os services filtram automaticamente os dados pelo `tenantId`:

```typescript
findAll(tenantId: string) {
  return this.prisma.contact.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}
```

---

## 🛡️ Proteção de Rotas

Todas as rotas do módulo de Contatos estão protegidas pelo `JwtAuthGuard`:

```typescript
@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  // ...
}
```

Isso garante que:
- ✅ Apenas usuários autenticados podem acessar as rotas
- ✅ Cada usuário só vê os dados do seu próprio tenant
- ✅ Não é possível acessar dados de outros tenants

---

## 📂 Arquivos Importantes

| Arquivo | Descrição |
|---|---|
| `apps/api/src/auth/jwt.strategy.ts` | Extrai tenantId do token JWT |
| `apps/api/src/auth/jwt-auth.guard.ts` | Guard de proteção de rotas |
| `apps/api/src/common/decorators/current-user.decorator.ts` | Decorator para acessar usuário autenticado |
| `apps/api/src/contacts/contacts.controller.ts` | Controller com proteção JWT |
| `apps/api/src/contacts/contacts.service.ts` | Service com filtro por tenantId |

---

## 🔄 Fluxo Completo

```
1. Usuário faz login
   ↓
2. Backend gera JWT com tenantId
   ↓
3. Frontend armazena JWT e envia em cada requisição (Header: Authorization: Bearer <token>)
   ↓
4. JwtAuthGuard valida o token
   ↓
5. JwtStrategy extrai tenantId e injeta em request.user
   ↓
6. Controller usa @CurrentUser() para pegar tenantId
   ↓
7. Service filtra dados pelo tenantId
   ↓
8. Retorna apenas dados do tenant do usuário
```

---

## 🚀 Implementação em Novos Módulos

Para adicionar multi-tenancy em um novo módulo:

### 1. Proteger o Controller
```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('novo-modulo')
@UseGuards(JwtAuthGuard)
export class NovoModuloController {
  // ...
}
```

### 2. Usar o Decorator @CurrentUser
```typescript
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Post()
create(@Body() dto: CreateDto, @CurrentUser() user: CurrentUserData) {
  return this.service.create(dto, user.tenantId);
}
```

### 3. Filtrar no Service
```typescript
findAll(tenantId: string) {
  return this.prisma.entidade.findMany({
    where: { tenantId },
  });
}

create(dto: CreateDto, tenantId: string) {
  return this.prisma.entidade.create({
    data: {
      ...dto,
      tenantId,
    },
  });
}
```

---

## ⚠️ Regras Importantes

### ✅ SEMPRE FAÇA:
1. Adicione `@UseGuards(JwtAuthGuard)` em controllers que precisam de autenticação
2. Use `@CurrentUser()` para pegar o tenantId do usuário autenticado
3. Filtre queries por `tenantId` no service
4. Adicione `tenantId` ao criar novos registros

### ❌ NUNCA FAÇA:
1. Usar um tenant padrão fixo (hardcoded)
2. Permitir acesso sem autenticação a dados sensíveis
3. Esquecer de filtrar por tenantId nas queries
4. Confiar em dados enviados pelo frontend (sempre use o tenantId do token)

---

## 🔧 Casos Especiais

### Funções Automatizadas (Cron Jobs)

Para funções automatizadas que não têm um usuário autenticado:

```typescript
async executarCronJob() {
  // Buscar todos os tenants ativos
  const tenants = await this.prisma.tenant.findMany({
    where: { isActive: true },
  });

  // Executar ação para cada tenant
  for (const tenant of tenants) {
    await this.processarPorTenant(tenant.id);
  }
}
```

### Rotas Públicas (Sem Autenticação)

Se precisar de uma rota pública, use o decorator `@Public()`:

```typescript
import { Public } from '../auth/public.decorator';

@Public()
@Get('public-data')
getPublicData() {
  // Esta rota não requer autenticação
}
```

---

## 📊 Exemplo Prático

### Cenário: Dois escritórios usando o sistema

**Escritório A (Tenant ID: abc-123)**
- Usuário: joao@escritorioA.com
- Contatos: 50 clientes

**Escritório B (Tenant ID: xyz-789)**
- Usuário: maria@escritorioB.com
- Contatos: 30 clientes

### Quando João faz login:
1. JWT gerado: `{ userId: "...", tenantId: "abc-123", ... }`
2. João acessa `/contacts`
3. Sistema filtra: `WHERE tenantId = 'abc-123'`
4. João vê apenas os 50 clientes do Escritório A

### Quando Maria faz login:
1. JWT gerado: `{ userId: "...", tenantId: "xyz-789", ... }`
2. Maria acessa `/contacts`
3. Sistema filtra: `WHERE tenantId = 'xyz-789'`
4. Maria vê apenas os 30 clientes do Escritório B

**✅ Isolamento total de dados garantido!**

---

## 🆘 Troubleshooting

### Erro: "Unauthorized"
- Verifique se o token JWT está sendo enviado no header `Authorization: Bearer <token>`
- Verifique se o token não expirou

### Erro: "tenantId is undefined"
- Verifique se o JWT contém o campo `tenantId`
- Verifique se o `JwtStrategy` está extraindo corretamente o tenantId

### Usuário vê dados de outros tenants
- Verifique se o service está filtrando por `tenantId`
- Verifique se o controller está passando o `tenantId` correto

---

## 📚 Referências

- [NestJS Guards](https://docs.nestjs.com/guards)
- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)
- [JWT Authentication](https://jwt.io/)
- [Prisma Multi-Tenancy](https://www.prisma.io/docs/guides/database/multi-tenancy)

---

**Última atualização:** 27/01/2026  
**Versão:** 2.0.0
