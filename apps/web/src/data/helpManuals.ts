import { HelpSection } from '../components/HelpModal';

export const helpContacts: HelpSection[] = [
  {
    title: 'Visão Geral (Contatos)',
    content: 'O módulo de <b>Contatos</b> permite que você gerencie seus clientes, partes contrárias, advogados e outros envolvidos nos processos.',
  },
  {
    title: 'Como Cadastrar um Novo Contato',
    content: '1. Clique no botão azul <b>"Novo Contato"</b> no topo da tela.<br/>2. Escolha se é Pessoa Física (CPF) ou Jurídica (CNPJ).<br/>3. Preencha os campos obrigatórios (Nome, E-mail, Telefone, e Endereço).<br/>4. Para salvar, clique em <b>"Salvar Contato"</b>. O contato aparecerá imediatamente na lista.',
  },
  {
    title: 'Edição e Exclusão',
    content: 'Na linha de cada contato, você encontra os botões de <b>Editar</b> (ícone de lápis) e <b>Excluir</b> (ícone de lixeira).<br/>Para editar, basta clicar no lápis, alterar os dados desejados e salvar. Para excluir, confirme a operação quando solicitada.',
  },
  {
    title: 'Busca e Filtros',
    content: 'Use a barra de pesquisa na parte superior para encontrar contatos pelo <b>Nome</b>, <b>CPF/CNPJ</b> ou <b>E-mail</b> de forma rápida. A filtragem ocorre enquanto você digita.',
  }
];

export const helpProcesses: HelpSection[] = [
  {
    title: 'Visão Geral (Processos)',
    content: 'O módulo de <b>Processos</b> organiza todos os seus casos jurídicos, permitindo o acompanhamento do status, valores, e prazos.',
  },
  {
    title: 'Como Cadastrar um Novo Processo',
    content: '1. Clique em <b>"Novo Processo"</b>.<br/>2. Preencha o <b>Número CNJ</b> do processo e os dados básicos (Ação, Vara, Comarca).<br/>3. Você pode vincular os contatos envolvidos (Cliente e Parte Contrária) diretamente na aba de Partes.<br/>4. Salve para registrar no sistema.',
  },
  {
    title: 'Análise Mágica (IA)',
    content: 'Se você possuir um arquivo PDF da inicial ou da sentença do processo, você pode usar o botão de <b>Análise com IA</b>. O sistema preencherá automaticamente os dados capturados do documento, poupando tempo de digitação manual.',
  },
  {
    title: 'Acompanhamento',
    content: 'Sempre que houver movimentações, você pode atualizar a etapa no sistema para <i>Ativo</i>, <i>Arquivado</i>, <i>Suspenso</i>, etc. Na listagem de processos, clique no ícone de lápis para atualizar ou adicionar andamentos.',
  }
];

export const helpAgenda: HelpSection[] = [
  {
    title: 'Visão Geral (Agenda)',
    content: 'A <b>Agenda</b> é o seu calendário centralizado para compromissos, audiências, prazos processuais e reuniões.',
  },
  {
    title: 'Como Agendar um Compromisso',
    content: '1. Clique em um dia vazio no calendário ou no botão para adicionar novo evento.<br/>2. Defina um <b>Título</b>, a <b>Data e Hora</b> de início e fim.<br/>3. Você pode definir categorias de cores para organizar visualmente (ex: Audiência em vermelho, Reunião em Azul).<br/>4. Se houver um processo associado, você pode vinculá-lo no campo correspondente.',
  },
  {
    title: 'Visualizações',
    content: 'No canto superior, você pode alternar a visualização entre <b>Mês, Semana ou Dia</b>, permitindo uma análise mais estreita ou ampla da sua produtividade.',
  }
];

export const helpAtendimento: HelpSection[] = [
  {
    title: 'Visão Geral (Atendimento/Chat)',
    content: 'O <b>Atendimento CRM</b> é onde você gerencia a comunicação em tempo real via WhatsApp com seus contatos, sem sair do sistema.',
  },
  {
    title: 'Respondendo Mensagens',
    content: '1. As conversas que aguardam resposta aparecem na fila na coluna da esquerda.<br/>2. Ao clicar em uma conversa, os dados do contato aparecem à direita, e a tela de chat no centro.<br/>3. Digite sua mensagem no campo inferior e aperte <b>Enviar</b> (ou Enter).<br/>4. Use o ícone de clipe para enviar <b>Arquivos/Imagens</b> ou o botão de <b>Microfone</b> para enviar áudios.',
  },
  {
    title: 'Funções Avançadas',
    content: '<ul><li><b>Agendamento:</b> Você pode agendar o envio de uma mensagem para uma data e hora futura.</li><li><b>Kanban:</b> Navegue até o módulo Kanban (no menu lateral de ícones) para ver as conversas movendo por funil de vendas/atendimento.</li><li><b>Respostas Rápidas (Raios):</b> Salve textos enormes que você repete muito e ative-os apenas digitando uma barra no chat (ex: <i>/bomdia</i>).</li></ul>',
  }
];

export const helpFinancial: HelpSection[] = [
  {
    title: 'Visão Geral (Financeiro)',
    content: 'O <b>Financeiro</b> controla todo o seu contas a pagar (Despesas) e a receber (Receitas), além do acompanhamento de saldos de contas bancárias.',
  },
  {
    title: 'Lançando Transações Simples',
    content: '1. Clique em <b>"Nova Transação"</b>.<br/>2. Escolha entre <b>Receita</b> (dinheiro entrando) ou <b>Despesa</b> (dinheiro saindo).<br/>3. Informe o valor, descrição, vencimento e e clique em Salvar.<br/><br/><i>Dica: O campo Periodicidade agora possui sugestões rápidas (Mensal, Quinzenal, Semanal) e pode ser digitado livremente!</i>',
  },
  {
    title: 'Parcelamentos e Liquidação',
    content: '<ul><li>Parcele faturas criando diretamente de forma parcelada (ex: Escolha número de parcelas). O sistema gerará o registro Pai e as filhas.</li><li>Para <b>Baixar (Liquidar)</b> uma conta, clique no ícone da Calculadora verde. Uma tela abrirá para você digitar possíveis <b>Juros, Multa ou Descontos</b> antes de informar que o dinheiro caiu na sua Conta Bancária efetivamente.</li></ul>',
  },
  {
    title: 'Contas Bancárias',
    content: 'Acesse a visão "Contas Bancárias" para cadastrar caixas, cofre e contas reais. Ao liquidar uma transação, o valor entra ou sai diretamente do saldo dessa conta.',
  }
];

export const helpMicrosoft365: HelpSection[] = [
  {
    title: 'Integração OneDrive / SharePoint (Visão Geral)',
    content: 'A integração com o <b>Microsoft 365</b> permite que os arquivos e documentos (PDFs, petições geradas) de processos e contatos sejam salvos automaticamente na nuvem da Microsoft.',
  },
  {
    title: 'Como Configurar (Azure Portal)',
    content: '1. Acesse o portal do <b>Microsoft Entra ID (Azure AD)</b>.<br/>2. Vá em `Registros de Aplicativo` e crie um novo.<br/>3. Anote o <b>Client ID</b> e o <b>Tenant ID</b>.<br/>4. Crie um <b>Segredo do Cliente (Client Secret)</b> e copie o <i>Valor</i>.<br/>5. Conceda permissões de API tipo `Application` (Files.ReadWrite.All e Sites.ReadWrite.All) com <b>consentimento do administrador</b>.',
  },
  {
    title: 'ID da Pasta Raiz (Folder ID)',
    content: 'O sistema criará as pastas dos processos dentro de uma pasta base do seu OneDrive. Para pegar o ID dessa pasta:<br/>1. Acesse a pasta raiz pelo navegador.<br/>2. Na URL, procure pela sequência após <code>id=</code> (frequentemente contendo <i>%252</i> que pode precisar ser decodificada, ou apenas copie a partir de algo como b! ou 01...).<br/>3. Cole essa sequência no campo <b>ID da Pasta Raiz no OneDrive</b>.',
  },
  {
    title: 'Mecânica das Pastas',
    content: '<ul><li><b>Processos:</b> É criada a pasta "Nome do Cliente > Número do Processo". Os documentos adicionados via painel do processo são carregados fisicamente no OneDrive.</li><li>Se você alterar o nome/número do processo na plataforma, o OneDrive será notificado para <b>renomear a pasta</b> correspondente automaticamente.</li></ul>',
  }
];
