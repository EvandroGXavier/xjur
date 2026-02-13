# 🚀 Plano: Módulo Universal de Importação de Contatos (Dr.X)

## 1. Visão Geral
Criação de um módulo eficiente e universal para importação massiva de contatos a partir de planilhas (.xlsx, .xls, .csv). O sistema deve ser agnóstico à estrutura do arquivo original, permitindo ao usuário mapear colunas do arquivo para os campos do sistema Dr.X.

## 2. Arquitetura da Solução

### 2.1 Backend (NestJS)
- **Biblioteca**: `xlsx` (SheetJS) ou `csv-parser` para leitura de arquivos.
- **Service**: `ContactsImportService`
  - `parseFile(file)`: Lê o arquivo e retorna os cabeçalhos (colunas) e uma amostra (preview) dos dados.
  - `validateMapping(mapping)`: Valida se os campos obrigatórios do sistema (Nome) foram mapeados.
  - `executeImport(fileId, mapping)`: Processa o arquivo usando o mapeamento definido pelo usuário, converte para DTOs e insere no banco.
- **Database**: Utilização de `prisma.$transaction` para inserção em lote, garantindo atomicidade (tudo ou nada) ou processamento resiliente (reportar erros individuais).

### 2.2 Frontend (React + Shadcn UI)
- **Wizard de Importação**:
  1.  **Upload**: Área de drag-and-drop para o arquivo.
  2.  **Mapeamento**: Interface visual onde o usuário liga as colunas do arquivo ("Nome Cliente", "Tel", "CPF") aos campos do sistema ("name", "phone", "document").
  3.  **Revisão**: Tabela de preview mostrando como os dados ficarão após o mapeamento.
  4.  **Processamento**: Barra de progresso e relatório final (Sucesso/Erro).

## 3. Fluxo de Dados

1.  **Usuário**: Faz upload de `clientes_antigo.xlsx`.
2.  **Backend**: Salva temporariamente o arquivo e retorna:
    ```json
    {
      "fileId": "temp-12345",
      "headers": ["Nome Completo", "Telefone Celular", "E-mail Pessoal", "CPF"],
      "preview": [
        { "Nome Completo": "João Silva", "Telefone Celular": "11999999999", ... }
      ]
    }
    ```
3.  **Frontend**: Exibe as colunas encontradas e permite o "De-Para":
    - `name` -> "Nome Completo"
    - `phone` -> "Telefone Celular"
    - `email` -> "E-mail Pessoal"
    - `document` -> "CPF"
4.  **Backend**: Recebe o comando de execução com o ID do arquivo e o mapa de campos.
5.  **Processamento**:
    - Normaliza os dados (remove formatação de CPF/CNPJ, valida emails).
    - Verifica duplicidade pelo `document` (CPF/CNPJ).
    - Insere `Contact`, `Address`, `PersonDetails`.

## 4. Detalhamento Técnico

### 4.1 Campos Suportados (Mapping)
O sistema deve suportar o mapeamento para:
- **Dados Básicos**: Nome, Email, Telefone, Documento (CPF/CNPJ), Tipo (PF/PJ).
- **Endereço**: Rua, Número, Bairro, Cidade, Estado, CEP.
- **Detalhes PF**: RG, Data Nascimento, Profissão, Estado Civil.
- **Detalhes PJ**: Razão Social, Inscrição Estadual.
- **Observações**: Mapear colunas extras para o campo de notas.

### 4.2 Tratamento de Erros e Validação
- **Linhas Inválidas**: Ignorar linhas sem nome ou com documento inválido (opcional).
- **Relatório**: Ao final, gerar um JSON/CSV com as linhas que falharam e o motivo.

## 5. Implementação (Passo a Passo)

### Fase 1: Backend
1.  Instalar dependências: `npm install xlsx multer`.
2.  Criar `ContactsImportService` no módulo `contacts`.
3.  Criar DTOs para o mapeamento (`ImportMappingDto`).
4.  Implementar Endpoint `POST /contacts/import/upload` (Parser).
5.  Implementar Endpoint `POST /contacts/import/execute` (Processor).

### Fase 2: Frontend
1.  Criar rota `/contacts/import`.
2.  Desenvolver componente `ImportWizard`.
3.  Implementar Seletor de Arquivos.
4.  Implementar Componente de Mapeamento (Drag & Drop ou Select).
5.  Integrar com a API.

## 6. Próximos Passos
- Aprovar o plano.
- Iniciar implementação do Backend (Service e Controller).
- Iniciar implementação do Frontend (Tela de Importação).
