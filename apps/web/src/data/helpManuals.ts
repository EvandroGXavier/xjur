import { HelpSection } from '../components/HelpModal';

export const helpContacts: HelpSection[] = [
  {
    title: 'Visão Geral (Contatos)',
    content: 'O módulo de <b>Contatos</b> permite que você gerencie seus clientes, partes contrárias, advogados e outros envolvidos nos processos.<br/><br/><b>💡 Dica de Cadastro:</b> Se você não tiver os dados obrigatórios no momento, pode usar os padrões <b>99 99999999</b> para telefones e <b>nt@nt.com.br</b> para e-mail. Estes valores permitem duplicidade na base de dados para não travar o cadastro, e indicam que as informações reais ainda não foram obtidas.',
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
  },
  {
    title: 'Atalhos e Dicas de Uso',
    content: '<ul><li><b>F2 ou +</b>: Novo Contato.</li><li><b>ESC</b>: Cancelar ou fechar a janela atual.</li><li><b>Duplo Clique</b>: Edita o contato rapidamente se clicado na linha da tabela.</li><li><b>Salvar e Sair</b>: Pressione para salvar o registro e já fechar a tela.</li></ul>',
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
  },
  {
    title: 'Atalhos Rápidos',
    content: '<ul><li><b>F2 ou +</b>: Adicionar Novo Processo / Novo Andamento.</li><li><b>ESC</b>: Fechar/Cancelar a ação atual.</li><li><b>Duplo Clique</b>: Ao aplicar um clique duplo na tabela, o processo se abrirá instantaneamente.</li></ul>',
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
  },
  {
    title: 'Navegação Ágil',
    content: '<ul><li><b>F2 ou +</b>: Ativa a janela de Novo Compromisso.</li><li><b>ESC</b>: Fechar janelas ou cancelar edição.</li><li><b>Auto-Foco</b>: Ao tentar incluir qualquer registro o campo Título será selecionado sozinho para digitar rápido.</li></ul>',
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
  },
  {
    title: 'Atalhos Sistêmicos',
    content: '<ul><li><b>F2 ou +</b>: Cria ou abre a janela para um Novo Atendimento.</li><li><b>ESC</b>: Cancela a operação atual ou fecha o modal em destaque.</li></ul>',
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
  },
  {
    title: 'Agilidade Financeira',
    content: '<ul><li><b>F2 ou +</b>: Cria rapidamente uma Nova Transação / Contas a Pagar ou Receber.</li><li><b>ESC</b>: Fecha modais e cancela lançamentos.</li><li><b>Duplo Clique</b>: Dois cliques na listagem abre diretamente a janela da transação para edição e foca o Valor.</li><li><b>Salvar vs Salvar e Sair</b>: Você pode apenas "Salvar" para aplicar uma regra e manter a janela aberta lançando subitens.</li></ul>',
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


export const helpOmnichannelConnections: HelpSection[] = [
  {
    title: 'Visao Geral (Conexoes & Agente Omnichannel)',
    content: 'Este modulo centraliza a operacao dos novos recursos de <b>conexao por canal</b> e da nova <b>camada omnichannel do agente</b>. A partir desta implantacao, toda entrada relevante pode ser normalizada para uma conversa canonica interna, vinculada ao <b>Contato</b>, <b>Ticket</b>, <b>Conexao</b> e canal de origem.<br/><br/><b>Canais previstos:</b> WhatsApp, E-mail, Instagram e Telegram.<br/><b>Camadas implantadas:</b> <i>AgentConversation</i>, <i>AgentMessage</i> e <i>AgentRun</i>.<br/><br/>Na pratica, isso permite que o sistema deixe de tratar cada canal como um fluxo isolado e passe a registrar tudo em um padrao unico, pronto para automacao, IA, roteamento e auditoria.',
  },
  {
    title: 'O que ja esta operacional hoje',
    content: '<ul><li><b>WhatsApp:</b> conexao real via Evolution + QR Code + tickets + mensagens ja operando na interface.</li><li><b>E-mail e Instagram:</b> a base omnichannel ja esta preparada e o sistema ja aceita entradas pelo webhook generico de comunicacoes.</li><li><b>Ticket novo:</b> a primeira mensagem agora entra corretamente como mensagem do contato, e nao como descricao interna do operador.</li><li><b>Memoria canonica:</b> toda mensagem relevante pode ser espelhada na nova camada do agente para futuras rotinas de IA, automacao e auditoria.</li></ul><br/><b>Importante:</b> para E-mail e Instagram, a conexao visual ja pode ser cadastrada nesta tela, mas o recebimento nativo definitivo dependera do adaptador externo do provedor. Enquanto isso, a operacao pode ser testada de forma real pelo endpoint <code>/api/communications/webhook</code>.',
  },
  {
    title: 'Como operar a tela Conexoes & Canais',
    content: '1. Clique em <b>Nova Conexao</b>.<br/>2. Escolha o canal: <b>WHATSAPP</b>, <b>EMAIL</b>, <b>INSTAGRAM</b> ou <b>TELEGRAM</b>.<br/>3. Informe um nome operacional claro, como <i>Atendimento Principal</i>, <i>Financeiro Email</i> ou <i>Instagram Comercial</i>.<br/>4. Se o canal for WhatsApp, preencha a URL e a API Key da Evolution quando necessario.<br/>5. Salve a conexao.<br/>6. Use <b>Connect</b> para iniciar a conexao. No WhatsApp, o sistema abrira o processo de pareamento com QR Code. Nos demais canais, a conexao pode ser preparada e usada nos testes de webhook.<br/><br/><b>Dica operacional:</b> use nomes de conexao por finalidade e nao por pessoa. Exemplo: <i>WA Financeiro</i> e melhor que <i>Celular Joao</i>.',
  },
  {
    title: 'Fluxo esperado por canal',
    content: '<ul><li><b>WhatsApp:</b> a mensagem entra pela Evolution, vira TicketMessage e tambem e registrada na camada omnichannel do agente.</li><li><b>E-mail:</b> o ideal e que cada thread vire um <code>externalThreadId</code> estavel. O remetente vai em <code>from</code> e o assunto em <code>subject</code>.</li><li><b>Instagram:</b> use o identificador do remetente em <code>from</code> e o ID da conversa/DM em <code>externalThreadId</code>.</li><li><b>Telegram:</b> a base ja esta prevista no modelo, mas a interface nativa pode ser adicionada depois sem refazer a memoria.</li></ul><br/>Sempre que possivel, envie tambem: <code>connectionId</code>, <code>externalMessageId</code>, <code>contentType</code> e <code>metadata</code>. Isso melhora rastreabilidade, deduplicacao e auditoria.',
  },
  {
    title: 'Primeiro atendimento: do canal ate a conversa',
    content: '1. Cadastre a conexao do canal nesta tela.<br/>2. Coloque a conexao em funcionamento usando <b>Connect</b> ou o webhook de teste.<br/>3. Envie uma primeira mensagem real ou simulada para o canal.<br/>4. Acesse o modulo <b>Atendimento</b> e clique em <b>Chats</b> no menu lateral.<br/>5. Procure a nova conversa na lista da esquerda.<br/>6. Clique no atendimento para abrir o historico e os dados do contato.<br/><br/><b>O que deve acontecer:</b><ul><li>o contato deve ser localizado ou criado</li><li>o ticket deve aparecer na fila</li><li>a primeira mensagem deve estar visivel no centro da tela</li><li>o atendimento deve ficar pronto para resposta do operador</li></ul><br/><b>Se nao aparecer:</b> revise <code>tenantId</code>, <code>channel</code>, <code>connectionId</code> e o envio para <code>/api/communications/webhook</code>.',
  },
  {
    title: 'Como responder e enviar mensagens ao cliente',
    content: 'Depois de abrir o atendimento em <b>Chats</b>, use a area inferior da conversa para responder.<br/><br/>1. Clique no atendimento desejado na coluna da esquerda.<br/>2. Digite a resposta no campo <b>Digite...</b> na parte inferior.<br/>3. Pressione <b>Enter</b> ou clique no botao de envio para responder.<br/>4. Se quiser enviar arquivo, use o icone de <b>clipe</b> antes do envio.<br/>5. Se quiser enviar audio, use o icone de <b>microfone</b> quando o campo estiver vazio.<br/><br/><b>Resultado esperado:</b><ul><li>a sua mensagem aparece no historico da conversa</li><li>o atendimento continua vinculado ao mesmo ticket</li><li>o contato segue no mesmo contexto do canal de origem</li></ul><br/><b>Dica pratica:</b> para validar o primeiro atendimento completo, responda a mensagem inicial e confirme no historico que existe pelo menos uma mensagem recebida do cliente e uma enviada pelo operador.',
  },
  {
    title: 'Exemplo pratico testavel: E-mail',
    content: `Use o PowerShell abaixo para simular uma entrada de e-mail no sistema:<br/><br/><pre><code>Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/communications/webhook" -ContentType "application/json" -Body (@{
  tenantId = "SEU_TENANT_ID"
  channel = "EMAIL"
  from = "cliente.teste@exemplo.com"
  name = "Cliente Teste"
  content = "Preciso de retorno sobre o contrato enviado ontem."
  connectionId = "ID_DA_CONEXAO_EMAIL"
  externalThreadId = "email-thread-001"
  externalMessageId = "email-msg-001"
  subject = "Retorno de contrato"
  contentType = "TEXT"
  metadata = @{ mailbox = "contato@seudominio.com.br"; provider = "manual-test" }
} | ConvertTo-Json -Depth 6)</code></pre><br/><b>Resultado esperado:</b><ul><li>o sistema localiza ou cria o contato</li><li>cria ou atualiza um ticket</li><li>registra a mensagem recebida</li><li>espelha a entrada na memoria omnichannel do agente</li></ul>`,
  },
  {
    title: 'Exemplo pratico testavel: Instagram',
    content: `Use o PowerShell abaixo para simular uma DM do Instagram:<br/><br/><pre><code>Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/communications/webhook" -ContentType "application/json" -Body (@{
  tenantId = "SEU_TENANT_ID"
  channel = "INSTAGRAM"
  from = "@cliente_ig_teste"
  name = "Cliente Instagram"
  content = "Ola, vim pelo Instagram e quero saber sobre honorarios."
  connectionId = "ID_DA_CONEXAO_INSTAGRAM"
  externalThreadId = "ig-thread-001"
  externalMessageId = "ig-msg-001"
  contentType = "TEXT"
  metadata = @{ profile = "cliente_ig_teste"; provider = "manual-test" }
} | ConvertTo-Json -Depth 6)</code></pre><br/><b>Resultado esperado:</b><ul><li>se o contato ainda nao existir, ele sera criado como lead</li><li>o ticket sera aberto ou reaproveitado</li><li>a mensagem sera vinculada ao canal Instagram</li><li>a conversa canonica do agente sera alimentada com o mesmo thread externo</li></ul>`,
  },
  {
    title: 'Exemplo pratico testavel: WhatsApp real',
    content: '1. Cadastre ou edite uma conexao do tipo <b>WHATSAPP</b> nesta tela.<br/>2. Clique em <b>Connect</b>.<br/>3. Leia o QR Code com o telefone correspondente.<br/>4. Envie uma mensagem real do celular para essa instancia.<br/>5. Abra o modulo <b>Atendimento</b> e confirme o ticket/mensagem.<br/><br/><b>Resultado esperado:</b><ul><li>a mensagem aparece no ticket</li><li>o contato e criado ou atualizado</li><li>midias sao armazenadas quando houver payload suportado</li><li>a camada omnichannel recebe o espelho da mensagem com <code>externalThreadId</code> e <code>connectionId</code></li></ul><br/><b>Teste complementar:</b> responda pela tela de Atendimento e confirme que a conversa continua vinculada ao mesmo ticket.',
  },
  {
    title: 'Checklist de validacao e problemas comuns',
    content: '<ul><li><b>Conexao nao conecta:</b> revise URL/API Key da Evolution, status da conexao e versao configurada.</li><li><b>Ticket nao aparece:</b> confira <code>tenantId</code>, canal, e se o webhook foi enviado para <code>/api/communications/webhook</code>.</li><li><b>Contato duplicado:</b> padronize o valor de <code>from</code> e de <code>externalThreadId</code> nos testes.</li><li><b>E-mail/Instagram sem inbound nativo:</b> use o exemplo de webhook manual ate o adaptador do provedor ser ligado.</li><li><b>Teste repetido criando entradas extras:</b> altere <code>externalMessageId</code> ou mantenha IDs estaveis quando quiser validar deduplicacao por fluxo.</li></ul><br/><b>Dica final:</b> para auditoria operacional, sempre documente nos testes qual conexao foi usada, qual canal foi disparado e qual <code>externalThreadId</code> representava a conversa.',
  },
];
