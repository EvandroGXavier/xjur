
# Manual de Operação: Sistema de Login e Gestão SaaS Autônoma
**Dr.X Intelligence - Versão 2.0 (Local/SaaS Hybrid)**

## 1. Visão Geral
O sistema Dr.X agora opera com um módulo de autenticação autônomo e resiliente, permitindo operação tanto em VPS isolada quanto em ambiente de desenvolvimento local (Google IDX), sem dependência exclusiva de serviços externos como Clerk para o fluxo crítico de login.

### Destaques da Arquitetura:
- **Autonomia Total**: Login e Gestão de Sessão 100% locais via JWT (JSON Web Tokens).
- **Segurança Reforçada**: Hash de senhas com `bcryptjs` (Padrão Indústria).
- **Multi-Tenant Nativo**: Isolamento de dados por empresa (`tenantId`) em todas as operações.
- **Gestão SaaS Integrada**: Painel administrativo para criar planos e gerenciar inquilinos.

---

## 2. Fluxo de Autenticação (Login)

### Para o Usuário Final (Advogado/Colaborador):
1.  **Acesso**: Navegue até `/login`.
2.  **Credenciais**: Insira o e-mail cadastrado e a senha.
3.  **Validação**: O sistema verifica o hash da senha no banco de dados local.
4.  **Sessão**: Se válido, um Token JWT é gerado e armazenado no navegador (`localStorage`).
    - *Expiração*: O token tem validade configurada (padrão: 60 minutos) para segurança.
5.  **Redirecionamento**: O usuário é levado ao Dashboard principal.

### Detalhes Técnicos:
-   **Endpoint**: `POST /api/auth/login`
-   **Payload**: `{ email, password }`
-   **Resposta Sucesso**: `{ access_token, user: { id, name, email, role, tenantId, ... } }`

---

## 3. Cadastro de Novos Escritórios (Onboarding)

O sistema permite que novos escritórios se cadastrem autonomamente.

1.  **Acesso**: Navegue até `/register`.
2.  **Etapa 1 - Dados da Empresa**:
    -   Nome do Escritório.
    -   CNPJ ou CPF (Documento Único).
3.  **Etapa 2 - Dados do Administrador**:
    -   Nome do Responsável.
    -   E-mail Profissional (Será o login principal).
    -   Senha Forte.
4.  **Processamento**:
    -   O sistema cria um novo `Tenant` (Empresa).
    -   Cria o usuário `OWNER` vinculado a este Tenant.
    -   Define a senha com criptografia segura (`bcrypt`).
5.  **Conclusão**: O usuário é redirecionado para o Login.

---

## 4. Painel de Gestão SaaS (Super Admin)

Disponível em `/settings` -> Aba **Empresas** e **Planos**.
*Apenas usuários com permissão ou acesso direto ao banco devem operar configurações críticas.*

### Funcionalidades:
-   **Listar Empresas**: Visualização de todos os tenants cadastrados.
-   **Criar Empresa Manual**: Permite adicionar um cliente manualmente.
-   **Editar Empresa**: Alterar nome, documento, plano ou status (Ativo/Inativo).
-   **Redefinir Senha**: O admin pode resetar a senha do Owner de um escritório.
-   **Gestão de Planos**: Criar planos (Basic, Pro, etc) com limites de usuários e armazenamento.

### Segurança:
-   As rotas de gestão (`/saas/*`) são protegidas por `JwtAuthGuard`. Apenas usuários autenticados podem acessá-las.

---

## 5. Gestão de Equipe (Usuários)

Disponível em `/users`.

### Funcionalidades:
-   **Listagem**: Veja todos os usuários do seu escritório.
-   **Adicionar Membro**: Crie contas para advogados ou estagiários.
    -   O sistema verifica automaticamente o limite de usuários do seu Plano.
-   **Remover Membro**: Revogue acesso de ex-colaboradores.
-   **Cargos**:
    -   `OWNER`: Dono da conta (Acesso total).
    -   `ADMIN`: Gestor do escritório.
    -   `MEMBER`: Advogado/Colaborador (Acesso operacional).

---

## 6. Procedimentos Técnicos & Troubleshooting

### Verificar Logs de Autenticação
Se houver erro de login, verifique o console do navegador (F12) e os logs do backend.
-   **Erro 401 (Unauthorized)**: Senha incorreta ou usuário não encontrado.
-   **Erro 403 (Forbidden)**: Usuário inativo ou plano expirado.

### Reset de Senha Manual (Banco de Dados)
Em caso de emergência (perda total de acesso), o admin do servidor pode resetar a senha via banco de dados:
1.  Gere um hash bcrypt de uma nova senha.
2.  Execute SQL: `UPDATE "User" SET password = 'NOVO_HASH' WHERE email = 'email@alvo.com';`

### Configuração de Ambiente (.env)
Certifique-se que as variáveis estão corretas:
-   `DATABASE_URL`: Conexão com o Postgres.
-   `JWT_SECRET`: Chave secreta para assinatura dos tokens **(Mantenha seguro!)**.

---

**Dr.X Intelligence** - *Tecnologia Jurídica de Ponta.*
