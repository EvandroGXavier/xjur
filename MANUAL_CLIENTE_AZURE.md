# Manual do Usuário - Integração Dr.X e Microsoft 365 (SaaS)

Este manual tem como objetivo guiar você, usuário administrador do escritório (Empresa/Tenant), a configurar a integração entre o Dr.X e o seu ambiente Microsoft 365. 

Com essa integração ativa, os arquivos gerados ou inseridos no Dr.X poderão ser salvos diretamente no seu **OneDrive/SharePoint**, de forma totalmente automatizada.

---

## 📌 1. O que você ganha com essa integração?
* **Centralização:** Seus documentos jurídicos e anexos de processos não ficam "soltos". Eles são enviados diretamente para a pasta da Microsoft do seu escritório.
* **Segurança:** O Dr.X utilizará a infraestrutura da Microsoft que o seu escritório já assina (OneDrive for Business ou SharePoint), aproveitando as políticas de backup da Microsoft.
* **Organização Automática:** O sistema criará pastas e subpastas para os seus processos diretamente no seu OneDrive.

---

## ⚙️ 2. Como configurar a integração no Dr.X?

### Passo 2.1 - Acesse as Configurações da Minha Empresa
1. Faça login no **Dr.X** com a sua conta de Administrador do Escritório.
2. No menu lateral esquerdo, clique em **Configuração**.
3. No menu superior da tela de Configurações, clique na aba **Minha Empresa** (ícone de prédio).

Você verá a tela "Configurações da Minha Empresa", com o Nome do seu Escritório e o seu CNPJ. 

### Passo 2.2 - Ative a Integração
1. Role a tela até encontrar a seção **"Integração com Microsoft 365"**.
2. Marque a caixa de seleção **Ativar Armazenamento OneDrive/SharePoint**.
3. Assim que você marcar, quatro novos campos vão aparecer. Deixe esta aba do Dr.X aberta.

Esses quatro campos (Tenant ID, Client ID, Client Secret e ID da Pasta Raiz) são as "chaves" do seu cadeado da Microsoft. Para conseguir essas chaves, precisamos ir ao **Portal do Azure**.

---

## ☁️ 3. Como obter os dados no Portal do Microsoft Azure?

> **Atenção:** Você precisa ter permissão de Administrador Global ou Desenvolvedor na conta Microsoft 365 do seu Escritório para realizar estes passos.

### Passo 3.1 - Acessando o Azure
1. Acesse o portal: [https://portal.azure.com/](https://portal.azure.com/)
2. Faça login com a conta Microsoft do seu escritório.

### Passo 3.2 - Registrar o Aplicativo (Dr.X)
1. Na barra de pesquisa principal do Azure, digite **Microsoft Entra ID** (antigo Azure Active Directory) e clique nele.
2. No menu lateral esquerdo (sob "Gerenciar"), clique em **Registros de aplicativo**.
3. Clique no botão **+ Novo registro**.
   * Em **Nome**, digite: `Integracao DrX`.
   * Tipos de conta com suporte: Escolha **Contas somente neste diretório organizacional**.
   * Em URI de Redirecionamento: Deixe em branco por enquanto.
4. Clique em **Registrar** lá no final.

### Passo 3.3 - Copiando os IDs Primários
Logo após registrar, você cairá na tela de "Visão Geral" do seu app. Lá estão duas chaves vitais:
1. Copie o **ID do Aplicativo (cliente)** e cole no campo **"Client ID (App)"** lá na tela do Dr.X.
2. Copie o **ID do Diretório (locatário)** e cole no campo **"Tenant ID (Diretório Azure)"** lá na tela do Dr.X.

### Passo 3.4 - Criando a Senha (Client Secret)
1. Ainda no Azure (no menu esquerdo do seu app registrado), clique em **Certificados e segredos**.
2. Na aba "Segredos do cliente", clique em **+ Novo segredo do cliente**.
3. Digite uma descrição (ex: `Senha DrX`) e escolha a Expiração (recomendado: *24 meses*).
4. Clique em Adicionar.
5. **CUIDADO!** O Azure vai mostrar o `Valor` secreto apenas esta vez! Copie exatamente o texto que aparece na coluna **Valor** e cole no campo **"Client Secret"** lá na tela do Dr.X.

### Passo 3.5 - Dando as Permissões para o Dr.X ler o OneDrive
O Dr.X precisa da sua permissão para manusear as pastas lá dentro (Application Permissions).

1. Ainda no Azure (no menu esquerdo), clique em **Permissões de APIs**.
2. Clique em **+ Adicionar uma permissão** e escolha **Microsoft Graph** (o botão grande e azul).
3. Na tela seguinte ("Que tipo de permissão..."), clique em **Permissões de aplicativo** (a opção da direita).
4. Uma barra de pesquisa surgirá. Digite "Files" e abra o submenu `Files`.
5. Marque a caixinha: **Files.ReadWrite.All**.
6. Clique no botão **Adicionar permissões** lá embaixo.
7. **Passo Fundamental:** Ao voltar para a lista de permissões, o status estará com um aviso amarelo alertando "Não concedido". Clique no botão acima da tabela que diz **✅ Conceder consentimento do administrador para [Nome do seu Tenente]** e confirme com *Sim*. A tabela deverá ficar toda com ícones verdes.

---

## 📁 4. Onde os arquivos serão salvos? (Configurando a Pasta Raiz)

Você precisa dizer ao Dr.X qual é a pasta principal no seu SharePoint (ou OneDrive) onde ele deve jogar tudo lá dentro.

Infelizmente, a Microsoft não exibe visualmente de forma simples o **ID** da pasta que você cria, e o sistema exige exatamente o **ID em código** (DriveID).

### A Forma Mais Simples de Obter a ID da Pasta

No momento da implementação local/SaaS, a arquitetura backend usa o e-mail do próprio Tenant (aquele configurado no cadastro da sua Empresa) como o e-mail Root para encontrar o One Drive.
Para que a integração valide com perfeição, os administradores de SaaS geralmente fornecem esse "ID da pasta" gerado por eles via Microsoft Graph API.

Caso você não tenha esse código em mãos:
**Coloque a raiz principal:**
Se você deixar ativada a integração com dados vazios para a "Pasta Raiz", não tem problema! A integração tentará usar a própria "root" do OneDrive da conta dona para criar as subpastas.

Se você utilizar a ferramenta "Microsoft Graph Explorer", você poderia pegar o ID assim:
1. Vá até o `https://developer.microsoft.com/en-us/graph/graph-explorer`
2. Logue-se
3. Teste o GET do endpoint: `https://graph.microsoft.com/v1.0/me/drive/root`
4. Na Resposta (Response Preview), localize o objeto `"id": "b!ABCD_XYZ123...."`. 
5. Este valor gigantesco e criptografado seria o seu Root ID. Cole isso no campo **"ID da Pasta Raiz"** do Dr.X.

---

## ✅ 5. Finalizando e Testando

1. Com todos os campos preenchidos na Aba **Minha Empresa** dentro do sistema Dr.X, clique em **Salvar Configurações**.
2. Vá até a seção de "Processos" e adicione um arquivo/histórico, ou permita que o Dr.X gere a petição inicial via IA.
3. Se a integração estiver correta, dentro de poucos segundos e sem necessidade de downloads manuais, aquele documento docx ou pdf já constará mágico dentro do seu gerenciador local OneDrive/SharePoint! 

Pronto! Caso alguma credencial fique inválida pelo tempo de expiração do Azure (daqui a alguns meses), basta repetir o processo *3.4* para gerar um novo segredo (Client Secret) e recolar no seu sistema Dr.X.
