import { HelpSection } from '../components/HelpModal';
import { embeddedContentColor } from '../utils/themeColors';

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
    title: 'Configuração Geral de Processos',
    content: 'Use o botão de <b>Configurações de Processos</b> para abrir a central do módulo. Nela você encontra a estratégia de consulta oficial, credenciais do <b>DataJud</b>, preparo do <b>Eproc MG</b>, teste de conectividade e importação por <b>CNJ</b> sem sair da própria tela.',
  },
  {
    title: 'Estratégia Recomendada',
    content: 'O melhor caminho inicial é usar <b>DataJud / CNJ</b> como fonte oficial de consulta por número do processo. Esse fluxo é mais estável para implantação, facilita testes e deixa o sistema pronto para conectores mais profundos depois.',
  },
  {
    title: 'Eproc MG e Prontidão Institucional',
    content: 'A seção <b>Eproc MG / Prontidão</b> serve para documentar pedido institucional, status de convênio, endpoint formal, responsável e credenciais autorizadas. Assim o sistema fica preparado para integração profunda sem depender de automação frágil como base do produto.',
  },
  {
    title: 'Teste e Importação por CNJ',
    content: 'Na central de configuração você pode: <ul><li><b>Testar Integração</b> para validar a chave e o endpoint configurado</li><li><b>Consultar CNJ</b> para buscar um preview do processo</li><li><b>Cadastrar processo no sistema</b> usando o retorno consultado</li></ul><br/>Isso reduz cliques e acelera a validação da implantação.',
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
    title: 'Filtro por Período (Calendário Duplo)',
    content:
      'Na listagem de processos, você pode filtrar por um <b>período</b> usando o campo <b>"Atualizados (período)"</b> (calendário duplo).<br/><br/>' +
      '<b>Presets rápidos:</b> Hoje, Esta semana, Semana passada, Este mês, Mês passado, Este ano, Ano passado, etc.<br/><br/>' +
      '<b>Filtro Avançado:</b> no botão <b>Filtros</b>, campos de data como <b>Distribuição</b>, <b>Criado em</b> e <b>Atualizado em</b> suportam o operador <b>entre</b> com o mesmo calendário de período.',
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
    title: 'Filtro por Período (Calendário Duplo)',
    content:
      'Em <b>Transações</b>, abra <b>Filtros</b> e use os períodos:<ul>' +
      '<li><b>Período de lançamento</b> (quando o registro foi criado)</li>' +
      '<li><b>Período de vencimento</b> (quando deveria vencer)</li>' +
      '<li><b>Período de pagamento</b> (quando foi liquidado)</li>' +
      '</ul>' +
      'O seletor usa <b>calendário duplo</b> e <b>presets</b> (Hoje, Esta semana, Este mês, Este ano, etc.). Você pode combinar com filtros de valor, categoria, tags e status.',
  },
  {
    title: 'Agilidade Financeira',
    content: '<ul><li><b>F2 ou +</b>: Cria rapidamente uma Nova Transação / Contas a Pagar ou Receber.</li><li><b>ESC</b>: Fecha modais e cancela lançamentos.</li><li><b>Duplo Clique</b>: Dois cliques na listagem abre diretamente a janela da transação para edição e foca o Valor.</li><li><b>Salvar vs Salvar e Sair</b>: Você pode apenas "Salvar" para aplicar uma regra e manter a janela aberta lançando subitens.</li></ul>',
  }
];

export const helpMicrosoft365: HelpSection[] = [
  {
    title: 'Visao Geral da Integracao Microsoft 365',
    content: 'A integracao com o <b>Microsoft 365</b> permite autenticar no Graph, localizar uma <b>biblioteca/pasta raiz</b> do OneDrive ou SharePoint e criar subpastas de processos e documentos automaticamente.<br/><br/><b>Campos principais:</b><ul><li><b>Tenant ID:</b> diretorio Azure/Entra da empresa.</li><li><b>Client ID:</b> identificador da aplicacao registrada no Azure.</li><li><b>Client Secret:</b> segredo ativo da aplicacao.</li><li><b>Drive ID / Biblioteca:</b> identificador da biblioteca onde fica a pasta raiz.</li><li><b>ID da Pasta Raiz:</b> pasta mae onde o sistema criara as subpastas.</li><li><b>Observacoes:</b> instrucoes operacionais, responsaveis, ambiente e cuidados.</li></ul>'
  },
  {
    title: 'Passo 1: Registrar o App no Azure',
    content: '1. Acesse o <b>Microsoft Entra ID</b>.<br/>2. Entre em <b>App registrations</b> e clique em <b>New registration</b>.<br/>3. Defina um nome claro, como <i>DRX Office 365 - Empresa X</i>.<br/>4. Copie o <b>Application (client) ID</b> e o <b>Directory (tenant) ID</b>.<br/>5. Em <b>Certificates & secrets</b>, crie um novo segredo e copie o <b>Value</b> imediatamente.'
  },
  {
    title: 'Passo 2: Permissoes Necessarias',
    content: 'Em <b>API permissions</b>, adicione permissoes do tipo <b>Application</b> e conceda <b>Admin consent</b>.<br/><br/><b>Minimo recomendado para este fluxo:</b><ul><li><code>Files.ReadWrite.All</code></li><li><code>Sites.ReadWrite.All</code></li><li><code>User.Read.All</code></li></ul><br/><b>Por que User.Read.All?</b> Ele permite a descoberta automatica do Drive quando voce informar apenas a pasta raiz de um OneDrive corporativo.'
  },
  {
    title: 'Passo 3: Como Obter Drive ID e Pasta Raiz',
    content: 'O sistema funciona melhor quando voce informa <b>Drive ID</b> e <b>ID da Pasta Raiz</b>.<br/><br/><b>Opcao recomendada:</b> use o Graph Explorer ou uma chamada autenticada para localizar a biblioteca e a pasta.<br/><br/><b>Dica pratica:</b><ul><li>Links iniciados com <code>b!</code> normalmente representam um <b>Drive ID</b>.</li><li>IDs iniciados com algo parecido com <code>01...</code> normalmente representam um <b>item/pasta</b>.</li></ul><br/>Se voce preencher apenas a pasta raiz, o sistema tentara descobrir o Drive automaticamente durante o teste.'
  },
  {
    title: 'Passo 4: Observacoes Operacionais',
    content: 'Use o campo <b>Observacoes da Integracao</b> para registrar tudo que ajuda o admin a operar sem depender de memoria:<ul><li>qual conta Microsoft foi usada</li><li>se o ambiente e homologacao ou producao</li><li>qual pasta foi aprovada pelo TI</li><li>regras para criacao de pastas</li><li>ultimo teste executado e seu resultado</li></ul><br/>Esse campo tambem e ideal para documentar restricoes, links internos e orientacoes da equipe.'
  },
  {
    title: 'Passo 5: Como Testar na Tela',
    content: '1. Preencha os campos da integracao.<br/>2. Clique em <b>Testar Integracao</b>.<br/>3. O sistema valida a autenticacao no Azure.<br/>4. Depois tenta localizar a biblioteca/pasta configurada.<br/>5. Por fim cria uma <b>pasta temporaria</b> e remove em seguida.<br/><br/><b>Se o teste passar:</b> a integracao esta pronta para uso basico.<br/><b>Se falhar:</b> o painel mostrara o ponto exato da falha e recomendacoes objetivas.'
  },
  {
    title: 'Comportamento Esperado da Criacao de Pastas',
    content: 'Quando a integracao estiver valida, os processos podem receber pastas e subpastas dentro da pasta raiz configurada. O teste nao cria lixo permanente: ele cria uma pasta temporaria para prova de escrita e remove em seguida.<br/><br/><b>Importante:</b> se voce alterar a biblioteca ou a pasta raiz, execute o teste novamente antes de liberar o uso para a equipe.'
  },
  {
    title: 'Problemas Comuns e Solucao Rapida',
    content: '<ul><li><b>Falha ao autenticar:</b> revise Tenant ID, Client ID, Client Secret e validade do segredo.</li><li><b>Pasta nao localizada:</b> preencha tambem o <b>Drive ID</b> da biblioteca.</li><li><b>Sem permissao para criar:</b> confirme <code>Files.ReadWrite.All</code> e <code>Sites.ReadWrite.All</code> com consentimento do admin.</li><li><b>Teste descobre o Drive automaticamente:</b> salve o valor retornado para evitar novas buscas.</li><li><b>Diferenca entre OneDrive e SharePoint:</b> ambos funcionam, desde que a biblioteca e a pasta raiz estejam corretas.</li></ul>'
  },
];

const helpVideoEmbed = (envKey: string, title: string) => {
  const raw = String((import.meta as any)?.env?.[envKey] || '').trim();
  if (!raw) {
    return `<div style="border:1px dashed ${embeddedContentColor.border}; border-radius: 12px; padding: 12px; background: ${embeddedContentColor.surfaceInverse}; color:${embeddedContentColor.textInverse};">
      <b>Vídeo:</b> ${title}<br/>
      <span style="color:${embeddedContentColor.textInverseMuted};">(Configure <code>${envKey}</code> com um link de embed ou MP4 para aparecer aqui.)</span>
    </div>`;
  }

  const isMp4 = raw.toLowerCase().endsWith('.mp4');
  if (isMp4) {
    return `<video controls style="width:100%; border-radius:12px; border:1px solid ${embeddedContentColor.borderStrong}; margin-top: 8px;" src="${raw}"></video>`;
  }

  return `<div style="position:relative; width:100%; padding-top:56.25%; border-radius:12px; overflow:hidden; border:1px solid ${embeddedContentColor.borderStrong}; margin-top: 8px;">
    <iframe src="${raw}" title="${title}" style="position:absolute; inset:0; width:100%; height:100%; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
  </div>`;
};

export const helpSettingsMyTenant: HelpSection[] = [
  {
    title: 'Visão Geral (Minha Empresa)',
    content:
      'A aba <b>Minha Empresa</b> centraliza as configurações que valem para todo o seu escritório (tenant), como informações cadastrais e padrões usados na geração de documentos.',
  },
  {
    title: 'Cabeçalho e Rodapé das Peças (por tenant)',
    content:
      'Você pode definir um <b>cabeçalho</b> e um <b>rodapé</b> padrão para serem inseridos automaticamente em <b>todas as peças</b> geradas a partir de modelos (do sistema ou do escritório).<br/><br/>' +
      '<b>Onde fica:</b> <b>Configurações</b> > <b>Minha Empresa</b> > <b>Cabeçalho e Rodapé das Peças</b>.<br/><br/>' +
      '<b>Como usar:</b><ol>' +
      '<li>Preencha o editor do <b>Cabeçalho</b> com identificação do escritório e dados essenciais.</li>' +
      '<li>Preencha o editor do <b>Rodapé</b> com contato, data e assinatura.</li>' +
      '<li>Clique em <b>Salvar</b> para aplicar ao seu tenant.</li>' +
      '<li>Gere um documento pela Biblioteca: o cabeçalho/rodapé será inserido automaticamente.</li>' +
      '</ol><br/>' +
      '<b>Variáveis úteis:</b> <code>{{tenant.name}}</code>, <code>{{tenant.document}}</code>, <code>{{process.cnj}}</code>, <code>{{process.district}}</code>, <code>{{process.uf}}</code>, <code>{{contact.name}}</code>, <code>{{today.fullDate}}</code>.<br/><br/>' +
      '<img src="/help/settings/tenant-header-footer.svg" alt="Cabeçalho e rodapé por tenant" style="width:100%; border-radius:12px; border:1px solid rgb(51, 65, 85);" />',
  },
  {
    title: 'Exemplo pronto (copiar e ajustar)',
    content:
      '<pre><code>&lt;p&gt;&lt;strong&gt;{{tenant.name}}&lt;/strong&gt; — CNPJ/CPF {{tenant.document}}&lt;/p&gt;\\n' +
      '&lt;p&gt;Processo: {{process.cnj}} — {{process.district}}/{{process.uf}}&lt;/p&gt;\\n' +
      '\\n' +
      '&lt;p&gt;Cliente: {{contact.name}} — CPF/CNPJ {{contact.document}}&lt;/p&gt;\\n' +
      '&lt;p&gt;Data: {{today.fullDate}}&lt;/p&gt;</code></pre>',
  },
  {
    title: 'Vídeo rápido (configuração)',
    content: helpVideoEmbed('VITE_HELP_VIDEO_SETTINGS_HEADERFOOTER', 'Cabeçalho e Rodapé por tenant'),
  },
];

export const helpSettingsTags: HelpSection[] = [
  {
    title: "Visão Geral (Etiquetas / Tags)",
    content:
      "As <b>Tags globais</b> permitem padronizar marcações no sistema inteiro. Você cria a tag uma vez e define em quais módulos ela pode aparecer.<br/><br/>" +
      "<b>Regra principal:</b> cada módulo só enxerga tags que estiverem marcadas para ele (ex.: tags com escopo <b>Biblioteca</b> só aparecem na Biblioteca).",
  },
  {
    title: "Como criar/editar uma Tag",
    content:
      "<ol>" +
      "<li>Clique em <b>Nova Tag</b>.</li>" +
      "<li>Defina <b>Nome</b> (ex.: Cível, CPC, Contrato, Imóvel).</li>" +
      "<li>Escolha uma <b>cor</b> (identificação visual).</li>" +
      "<li>Em <b>Permitir uso em</b>, marque os módulos (Contato, Processo, Financeiro, Tarefa, Atendimento, Biblioteca).</li>" +
      "<li>Salve e teste no módulo escolhido.</li>" +
      "</ol><br/>" +
      "<b>Dica de padronização:</b> prefira nomes curtos e consistentes. Na interface, o sistema pode exibir com <code>#</code> automaticamente (ex.: <code>#Cível</code>).",
  },
  {
    title: "Exemplo prático (Biblioteca)",
    content:
      "Para organizar modelos na Biblioteca, crie tags como <b>Cível</b>, <b>CPC</b>, <b>Contrato</b> e marque o escopo <b>Biblioteca</b>. Assim, ao editar um modelo, você verá apenas as tags permitidas para a Biblioteca.<br/><br/>" +
      '<img src="/help/library/library-tags.svg" alt="Exemplo de tags na Biblioteca" style="width:100%; border-radius:12px; border:1px solid rgb(51, 65, 85);" />',
  },
  {
    title: "Vídeo rápido (tags por módulo)",
    content: helpVideoEmbed(
      "VITE_HELP_VIDEO_SETTINGS_TAGS",
      "Tags globais por módulo",
    ),
  },
];

export const helpLibrary: HelpSection[] = [
  {
    title: "Visão Geral (Biblioteca de Modelos)",
    content:
      "A <b>Biblioteca</b> centraliza suas <b>minutas</b>, <b>contratos</b> e <b>peças</b> para reutilização. Você pode manter modelos do <b>Escritório</b> (editáveis) e também usar modelos do <b>Sistema</b> (base/Visual Law).<br/><br/><b>Objetivo:</b> reduzir retrabalho e padronizar a redação, mantendo variáveis e estrutura prontas para o Word Online.<br/><br/>" +
      '<img src="/help/library/library-overview.svg" alt="Visão rápida da Biblioteca" style="width:100%; border-radius:12px; border:1px solid rgb(51, 65, 85);" />',
  },
  {
    title: "Editor de Textos Profissional (Justificar e Visual Law)",
    content:
      "O novo editor de documentos permite formatação jurídica de alta precisão:<ul>" +
      "<li><b>Alinhamento Justificado:</b> Use o botão <b>Justificar</b> na barra de ferramentas para garantir que o texto ocupe toda a largura da página, padrão em contratos e petições.</li>" +
      "<li><b>Blocos de Visual Law:</b> No botão de <b>Blocos Rápidos</b> (ícone de brilho ✨), você pode inserir caixas flutuantes e informativas estilizadas para destacar cláusulas críticas ou resumos.</li>" +
      "<li><b>Listas e Numeração:</b> O sistema agora garante que listas numeradas e com marcadores mantenham o recuo correto ao gerar o documento final.</li>" +
      "</ul>",
  },
  {
    title: "Variáveis Inteligentes (Multi-Partes)",
    content:
      "Pela primeira vez, o Xjur resolve o desafio de contratos com múltiplos compradores ou vendedores:<ul>" +
      "<li><b>Lista Automática:</b> Use <code>{{buyers.list.names}}</code> para gerar o texto \"João, Maria e José\" com gramática correta (vírgulas e conectivo \"e\").</li>" +
      "<li><b>Qualificação Automática:</b> Use <code>{{buyers.list.qualifications}}</code> para que o sistema gere o parágrafo jurídico completo de <b>todos</b> os compradores cadastrados no processo, incluindo nacionalidade, estado civil, documentos e endereço.</li>" +
      "<li><b>Variáveis Indexadas:</b> Precisa de um dado específico? Use <code>{{buyer.1.name}}</code> ou <code>{{seller.2.document}}</code> para acessar participantes individualmente.</li>" +
      "</ul>",
  },
  {
    title: "Dica de Eficácia no Endereço",
    content:
      "Para que a qualificação e as caixas de Visual Law funcionem perfeitamente, certifique-se de preencher o <b>Bairro</b> e o <b>Complemento</b> (novas variáveis <code>{{contact.address.neighborhood}}</code> e <code>{{contact.address.complement}}</code>) no cadastro do contato.",
  },
  {
    title: "Modelos do Sistema x Modelos do Escritório",
    content:
      "<b>Modelo do Sistema</b> aparece com selo <b>Sistema</b> e serve como base. Normalmente ele não é editável pelo usuário.<br/><br/>Para adaptar ao seu escritório, clique em <b>\"Personalizar\"</b>. Isso cria uma <b>cópia editável</b> (selo <b>Escritório</b>) mantendo a estrutura original.<br/><br/>" +
      '<img src="/help/library/library-personalizar.svg" alt="Como personalizar um modelo do Sistema" style="width:100%; border-radius:12px; border:1px solid rgb(51, 65, 85);" />',
  },
  {
    title: "Criar um Novo Modelo (Escritório)",
    content:
      "Clique em <b>\"Novo Modelo\"</b> e preencha:<ul><li><b>Título</b> e <b>Descrição</b> (orientações jurídicas internas)</li><li><b>Tags</b> para facilitar busca e padronização</li><li><b>Conteúdo</b> no editor (Visual Law/Word Online)</li></ul><br/>Ao final, clique em <b>\"Salvar Modelo\"</b>.",
  },
  {
    title: "Tags (Pesquisa rápida)",
    content:
      "As <b>Tags</b> servem para organizar e encontrar modelos rapidamente. Você pode:<ul><li>Digitar a tag e pressionar <b>Enter</b> para adicionar</li><li>Usar tags como <b>Cível</b>, <b>CPC</b>, <b>Contrato</b>, <b>Execução</b>, <b>Consumidor</b></li></ul><br/><b>Dica:</b> mantenha poucas tags bem consistentes (padronização) em vez de muitas variações.<br/><br/>" +
      '<img src="/help/library/library-tags.svg" alt="Exemplo de padronização de tags" style="width:100%; border-radius:12px; border:1px solid rgb(51, 65, 85);" />' +
      '<br/><br/><b>Exemplo pronto:</b><br/><code>#Cível #CPC #Contestação</code> (peças)<br/><code>#Contrato #Imóvel #CompraEVenda</code> (contratos)',
  },
  {
    title: "Variáveis Dinâmicas (Automação Base)",
    content:
      "No editor, use as <b>Variáveis Dinâmicas</b> para automatizar preenchimentos (ex.: <code>{{contact.name}}</code>, <code>{{process.cnj}}</code>, <code>{{today.fullDate}}</code>).<br/><br/>Quando o modelo for usado para gerar documento, o sistema substitui automaticamente as variáveis com dados reais.<br/><br/>" +
      '<img src="/help/library/library-variaveis.svg" alt="Exemplo de variáveis dinâmicas" style="width:100%; border-radius:12px; border:1px solid rgb(51, 65, 85);" />' +
      "<br/><br/><b>Exemplo pronto (copiar e colar):</b><pre><code>&lt;p&gt;Cliente: {{contact.name}} — CPF/CNPJ {{contact.document}}&lt;/p&gt;\n&lt;p&gt;Processo: {{process.cnj}} — {{process.district}}/{{process.uf}}&lt;/p&gt;\n&lt;p&gt;Data: {{today.fullDate}}&lt;/p&gt;</code></pre>",
  },
  {
    title: "Avançado (Metadata / Visual Law)",
    content:
      "Em <b>\"Mostrar avançado\"</b>, você pode manter uma <b>metadata em JSON</b> com seções, ajudas e comentários internos (não impressos). Isso ajuda o time a preencher corretamente e mantém um padrão de qualidade nas peças.",
  },
  {
    title: "Atalhos",
    content:
      "<ul><li><b>F2</b> (ou <b>+</b> no teclado numérico): Novo Modelo</li><li><b>ESC</b>: Fechar/cancelar editor</li><li><b>F1</b>: Abrir este manual</li></ul>",
  },
];

export const helpOmnichannelConnections: HelpSection[] = [
  {
    title: "Visao Geral (Conexoes & Agente Omnichannel)",
    content:
      "Este modulo centraliza a operacao dos novos recursos de <b>conexao por canal</b> e da nova <b>camada omnichannel do agente</b>. A partir desta implantacao, toda entrada relevante pode ser normalizada para uma conversa canonica interna, vinculada ao <b>Contato</b>, <b>Ticket</b>, <b>Conexao</b> e canal de origem.<br/><br/><b>Canais previstos:</b> WhatsApp, E-mail, Instagram e Telegram.<br/><b>Camadas implantadas:</b> <i>AgentConversation</i>, <i>AgentMessage</i> e <i>AgentRun</i>.<br/><br/>Na pratica, isso permite que o sistema deixe de tratar cada canal como um fluxo isolado e passe a registrar tudo em um padrao unico, pronto para automacao, IA, roteamento e auditoria.",
  },
  {
    title: "O que ja esta operacional hoje",
    content:
      "<ul><li><b>WhatsApp:</b> conexao real via Evolution + QR Code + tickets + mensagens ja operando na interface.</li><li><b>E-mail e Instagram:</b> a base omnichannel ja esta preparada e o sistema ja aceita entradas pelo webhook generico de comunicacoes.</li><li><b>Ticket novo:</b> a primeira mensagem agora entra corretamente como mensagem do contato, e nao como descricao interna do operador.</li><li><b>Memoria canonica:</b> toda mensagem relevante pode ser espelhada na nova camada do agente para futuras rotinas de IA, automacao e auditoria.</li></ul><br/><b>Importante:</b> para E-mail e Instagram, a conexao visual ja pode ser cadastrada nesta tela, mas o recebimento nativo definitivo dependera do adaptador externo do provedor. Enquanto isso, a operacao pode ser testada de forma real pelo endpoint <code>/api/communications/webhook</code>.",
  },
  {
    title: "Como operar a tela Conexoes & Canais",
    content:
      "1. Clique em <b>Nova Conexao</b>.<br/>2. Escolha o canal: <b>WHATSAPP</b>, <b>EMAIL</b>, <b>INSTAGRAM</b> ou <b>TELEGRAM</b>.<br/>3. Informe um nome operacional claro, como <i>Atendimento Principal</i>, <i>Financeiro Email</i> ou <i>Instagram Comercial</i>.<br/>4. Se o canal for WhatsApp, preencha a URL e a API Key da Evolution quando necessario.<br/>5. Salve a conexao.<br/>6. Use <b>Connect</b> para iniciar a conexao. No WhatsApp, o sistema abrira o processo de pareamento com QR Code. Nos demais canais, a conexao pode ser preparada e usada nos testes de webhook.<br/><br/><b>Dica operacional:</b> use nomes de conexao por finalidade e nao por pessoa. Exemplo: <i>WA Financeiro</i> e melhor que <i>Celular Joao</i>.",
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

export const helpAtendimentoV2: HelpSection[] = [
  {
    title: 'Visao Geral (Console de Atendimento)',
    content:
      'O novo <b>Atendimento</b> usa uma unica base canônica de conversas. Lista, painel lateral e Kanban enxergam o mesmo <b>Inbox</b>, então mudar etapa, fila, responsavel ou processo altera sempre o mesmo registro operacional.',
  },
  {
    title: 'Passo a Passo Pratico',
    content:
      '1. Use a busca e os filtros para encontrar a conversa.<br/>2. Clique no atendimento para abrir o historico no centro.<br/>3. Revise no painel lateral a <b>etapa</b>, <b>fila</b>, <b>responsavel</b> e o <b>processo principal</b>.<br/>4. Digite a resposta e pressione <b>Enter</b> para enviar. Use <b>Shift + Enter</b> para quebrar linha.<br/>5. Se houver anexo, clique no <b>clipe</b> antes do envio.<br/>6. Se a conversa deixar de ser apenas triagem, vincule ou pesquise o processo pela lateral.',
  },
  {
    title: 'Etapas do Funil',
    content:
      '<ul><li><b>Triagem:</b> entradas novas e primeira leitura.</li><li><b>Em atendimento:</b> conversa ativa da equipe.</li><li><b>Convertidos:</b> assuntos resolvidos ou encaminhados.</li><li><b>Encerrados:</b> fora da fila operacional.</li></ul><br/><b>Dica:</b> o selo <b>Aguardando cliente</b> funciona como destaque auxiliar e nao substitui a etapa principal.',
  },
  {
    title: 'Kanban e Operacao',
    content:
      'A aba <b>Kanban</b> mostra a mesma fila do console em formato de quadro. Arrastar um card muda a etapa real da conversa. Ao clicar em um card, o sistema abre diretamente o atendimento correspondente no console principal.',
  },
  {
    title: 'Checklist de Uso Diario',
    content:
      '<ul><li><b>Filtrar</b> por canal, responsavel, fila, nao lidos ou sem processo.</li><li><b>Atribuir</b> o responsavel correto antes de iniciar tratativas mais longas.</li><li><b>Vincular processo</b> sempre que a conversa virar atendimento juridico real.</li><li><b>Atualizar etapa</b> para manter o quadro confiavel.</li><li><b>Encerrar</b> somente quando o assunto sair da fila operacional.</li></ul>',
  },
  {
    title: 'Atalhos e Acoes Rapidas',
    content:
      '<ul><li><b>F1</b>: abre este manual.</li><li><b>Botao +</b>: cria um novo atendimento manual.</li><li><b>Enter</b>: envia a mensagem atual.</li><li><b>Shift + Enter</b>: quebra linha.</li><li><b>Atualizar fila</b>: recarrega a listagem do Inbox.</li></ul>',
  },
];

export const helpOmnichannelConnectionsV2: HelpSection[] = [
  {
    title: 'Visao Geral (Central de Canais)',
    content:
      'A aba <b>Canais</b> concentra somente a parte tecnica do omnichannel: conexoes, autenticação e preparo dos provedores. O objetivo é manter a tela principal de Atendimento limpa e focada em triagem, conversa, fila e processo.',
  },
  {
    title: 'Quando usar esta aba',
    content:
      '<ul><li><b>Antes da operacao:</b> cadastrar ou editar uma conexao de WhatsApp, Telegram ou outro canal.</li><li><b>Na manutencao:</b> verificar status, credenciais, QR Code, webhooks ou instancias.</li><li><b>Na implantacao:</b> preparar novos canais sem misturar setup tecnico com a fila diaria da equipe.</li></ul>',
  },
  {
    title: 'Fluxo Recomendado',
    content:
      '1. Crie a conexao com um nome operacional claro, como <i>WA Atendimento Principal</i>.<br/>2. Conecte ou autentique o canal.<br/>3. Teste o recebimento com uma mensagem real ou webhook controlado.<br/>4. Abra o modulo <b>Atendimento</b> e confirme se a conversa apareceu no Inbox.<br/>5. So depois disso libere o canal para uso da equipe.',
  },
  {
    title: 'Boas Praticas',
    content:
      '<ul><li>Use nomes de conexao por finalidade, nao por pessoa.</li><li>Documente qual instancia atende qual fila.</li><li>Depois de trocar credencial ou QR Code, valide o recebimento no Inbox.</li><li>Se um canal estiver instavel, resolva aqui antes de culpar a fila do atendimento.</li></ul>',
  },
  {
    title: 'Checklist de Validacao',
    content:
      '<ul><li><b>Conectou?</b> O canal mostra status saudavel nesta central.</li><li><b>Entrou no Inbox?</b> A mensagem aparece no modulo Atendimento.</li><li><b>Contato identificado?</b> A conversa mostra nome, canal e contexto corretos.</li><li><b>Fluxo continuo?</b> A equipe consegue responder sem sair do console principal.</li></ul><br/><b>Se algo falhar:</b> revise credenciais, webhook, tenant, canal e instancia antes de mexer no funil operacional.',
  },
];

export const helpTelegram: HelpSection[] = [
  {
    title: 'Visão Geral (Chatbot Telegram)',
    content: 'O módulo <b>Telegram</b> integra o seu bot oficial (criado via BotFather) diretamente ao ecossistema DrX. Ele suporta mensagens de texto, <b>transcrição de áudio (Voz)</b>, <b>leitura de documentos PDF</b> e integração total com o Agente de IA para automação jurídica.',
  },
  {
    title: 'Passo 1: Criando seu Bot no Telegram',
    content: '1. Abra o Telegram e procure por <b>@BotFather</b>.<br/>2. Digite <code>/newbot</code> e siga as instruções para dar um nome e um @username ao seu bot.<br/>3. Ao final, o BotFather enviará um <b>Token da API</b> (ex: <code>123456:ABC-DEF...</code>).<br/>4. <b>Guarde esse Token am segredo</b>, ele será usado na configuração do sistema.',
  },
  {
    title: 'Passo 2: Configurando no Xjur',
    content: '1. Vá em <b>Conexões & Canais</b> e clique em <b>Nova Conexão</b>.<br/>2. Escolha o canal <b>TELEGRAM</b>.<br/>3. No campo de configuração, cole o <b>Token da API</b> fornecido pelo BotFather.<br/>4. Salve a conexão e clique em <b>"Connect"</b>.<br/><br/><b>💡 Nota importante:</b> O sistema registrará automaticamente o Webhook para que as mensagens cheguem em tempo real.',
  },
  {
    title: 'Funcionalidades Mágicas (IA)',
    content: 'O bot do Telegram não apenas repete mensagens, ele possui superpoderes:<ul><li><b>Transcrição de Áudio:</b> Se o cliente enviar um áudio, a IA transcreve o conteúdo automaticamente e usa o texto para decidir o próximo passo.</li><li><b>Analista de PDF:</b> Ao enviar um arquivo PDF, o sistema extrai o texto e ativa a Skill de Leitor Jurídico para analisar o documento.</li><li><b>Modo Autônomo:</b> O DrX-Claw pode responder dúvidas, consultar processos e sugerir próximos passos diretamente no chat.</li></ul>',
  },
  {
    title: 'Como Testar no Ambiente Local (IDX)',
    content: 'Para testar o recebimento de mensagens na sua máquina local, você precisa de uma URL pública:<br/><br/>1. No terminal, rode o túnel: <code>npx cloudflared tunnel --url http://localhost:3000</code><br/>2. No arquivo <b>.env</b> da API, atualize a <code>APP_URL</code> com o link gerado pelo Cloudflare.<br/>3. Reinicie a API e clique em <b>"Connect"</b> na tela de conexões.<br/>4. Mande um "Oi" para o seu bot e veja a mágica acontecer!',
  },
  {
    title: 'Atalhos e Facilidades',
    content: '<ul><li><b>F1</b>: Abre este manual de ajuda em qualquer tela.</li><li><b>Botão de "Connect"</b>: Força a reinicialização do Webhook caso o bot pare de responder.</li><li><b>Whitelisting</b>: Você pode configurar no DrX-Claw quais usuários ou grupos de chat o bot tem permissão para responder.</li></ul>',
  }
];

export const helpSigilo: HelpSection = {
  title: '🛡️ Módulo Sigilo (Cofre de Segurança)',
  content: 'Recurso exclusivo para <b>Administradores</b> para armazenamento de informações sensíveis com criptografia.<br/><br/>' +
    '<b>Como acessar:</b> Pressione <b>CTRL + F8</b> em qualquer tela para abrir a autenticação. Após confirmar sua senha, a aba <b>SIGILO</b> ficará visível por 5 minutos nos formulários.<br/><br/>' +
    '<b>O que você pode fazer:</b><ul>' +
    '<li><b>Senhas e PINs:</b> Guarde credenciais gerais, certificados e acessos a sistemas externos.</li>' +
    '<li><b>Certificados Digitais (A1):</b> Faça o upload do arquivo .pfx/.p12 e controle a data de validade.</li>' +
    '<li><b>Upload de Arquivos:</b> Anexe instaladores ou chaves sensíveis diretamente no registro.</li>' +
    '</ul><br/>' +
    '<b>Importante:</b> a configuração de integração bancária não é mais feita no sigilo do contato. Agora ela fica em <b>Financeiro &gt; Contas Bancárias &gt; Sigilo</b>.',
};
