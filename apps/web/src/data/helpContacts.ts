import type { HelpSection } from '../components/HelpModal';

/**
 * Manual de ajuda do módulo Contatos — DR.X
 * Exibido via botão "Ajuda" ou atalho F1 / CTRL+F1 na tela de Contatos.
 */
export const helpContacts: HelpSection[] = [
  {
    title: 'Visão Geral do Módulo Contatos',
    content: `
      <p>O módulo <b>Contatos</b> é a base de identidade única do DR.X. Toda pessoa ou empresa que aparece em processos, atendimentos, propostas ou financeiro é gerenciada aqui.</p>
      <ul>
        <li><b>Pessoa Física (PF):</b> clientes, partes, advogados, peritos, testemunhas — identificados por CPF.</li>
        <li><b>Pessoa Jurídica (PJ):</b> empresas, escritórios, fornecedores — identificados por CNPJ.</li>
        <li><b>Lead:</b> contato sem CPF/CNPJ ainda definido, geralmente entrada por WhatsApp ou indicação.</li>
      </ul>
      <p>A listagem mostra <b>50 contatos por página</b>. Use a barra de busca e os filtros para localizar registros rapidamente sem carregar toda a base.</p>
    `,
  },
  {
    title: 'Grid Ultra Slim — Lendo a listagem',
    content: `
      <p>A grid foi projetada para alta densidade: até 15 registros visíveis por tela. Cada linha mostra:</p>
      <ul>
        <li><b>Nome / Razão Social</b> — clique para abrir o perfil. CPF/CNPJ aparece abaixo em fonte mono.</li>
        <li><b>Etiquetas (TAGs)</b> — clique na TAG para filtrar todos os contatos com aquela etiqueta.</li>
        <li><b>E-mail</b> — clique para abrir o cliente de e-mail.</li>
        <li><b>Telefone / WhatsApp</b> — ícone verde indica número vinculado ao WhatsApp.</li>
        <li><b>Menu de ações (⋯)</b> — aparece ao passar o mouse: Editar ou Excluir.</li>
      </ul>
      <p><b>Duplo clique</b> na linha abre o perfil completo do contato com todas as abas (Dados, Endereços, Processos, Financeiro).</p>
    `,
  },
  {
    title: 'Busca e Filtros',
    content: `
      <p>Use a barra de pesquisa para localizar pelo <b>nome</b>, <b>CPF/CNPJ</b> ou <b>telefone/WhatsApp</b>. A busca ocorre no servidor — não filtra apenas a página atual.</p>
      <p><b>Filtros avançados</b> (botão funil):</p>
      <ul>
        <li><b>Status:</b> Ativos, Inativos ou Todos.</li>
        <li><b>TAGs:</b> inclua ou exclua contatos por etiqueta.</li>
        <li><b>Dados PF:</b> CPF, RG, profissão, naturalidade, estado civil, CNH, etc.</li>
        <li><b>Dados PJ:</b> CNPJ, razão social, inscrição estadual.</li>
        <li><b>Endereço:</b> cidade, estado, bairro, CEP.</li>
        <li><b>Aniversariantes do mês:</b> filtre por mês de nascimento.</li>
      </ul>
      <p>Os filtros são <b>salvos automaticamente</b> na sessão. Ao voltar para a tela, seus filtros estarão ativos.</p>
    `,
  },
  {
    title: 'Paginação — navegando entre os registros',
    content: `
      <p>Com mais de 5.000 contatos, a base é carregada em <b>páginas de 50 registros</b> para garantir velocidade.</p>
      <ul>
        <li>Use os botões <b>Anterior / Próxima</b> no rodapé da grid para navegar.</li>
        <li>Clique diretamente no <b>número da página</b> para pular para ela.</li>
        <li>O total de contatos e o número de páginas aparecem no canto esquerdo do rodapé.</li>
        <li>Quando você aplica um filtro ou busca, a paginação <b>volta automaticamente para a página 1</b>.</li>
      </ul>
      <p><b>Dica:</b> use o campo de busca por nome para ir direto ao registro sem navegar páginas.</p>
    `,
  },
  {
    title: 'Cadastrando um Novo Contato',
    content: `
      <p>Clique em <b>"Novo Contato"</b> ou pressione <kbd style="background:#334155;padding:1px 6px;border-radius:4px;font-size:11px">N</kbd> para abrir o formulário.</p>
      <ol>
        <li>Informe o <b>Nome</b> completo (mínimo 3 caracteres).</li>
        <li>Escolha o tipo: <b>PF</b> (CPF), <b>PJ</b> (CNPJ) ou <b>Lead</b> (sem documento ainda).</li>
        <li>Preencha pelo menos um canal de contato: celular, telefone, e-mail ou documento.</li>
        <li>O sistema verifica duplicidade automaticamente por CPF/CNPJ, telefone, e-mail e nome.</li>
        <li>Clique em <b>Salvar</b>.</li>
      </ol>
      <p><b>Placeholders permitidos</b> quando os dados reais não estão disponíveis:</p>
      <ul>
        <li>Telefone: <code style="background:#1e293b;padding:1px 4px;border-radius:3px">99 99999-9999</code></li>
        <li>E-mail: <code style="background:#1e293b;padding:1px 4px;border-radius:3px">nt@nt.com.br</code></li>
      </ul>
    `,
  },
  {
    title: 'Deduplicação — Evitando Contatos Duplicados',
    content: `
      <p>O sistema bloqueia (Conflict 409) a criação de um contato quando detecta match em:</p>
      <ul>
        <li><b>CPF</b> ou <b>CNPJ</b> — comparação por dígitos sem formatação.</li>
        <li><b>E-mail</b> principal — exceto <code style="background:#1e293b;padding:1px 4px;border-radius:3px">nt@nt.com.br</code>.</li>
        <li><b>Telefone / WhatsApp</b> — compara os últimos 8 dígitos (cobre variantes com e sem 9º dígito).</li>
        <li><b>Nome</b> — comparação case-insensitive.</li>
      </ul>
      <p>Quando há conflito, o sistema informa <b>qual campo gerou a duplicidade</b> e o nome do contato existente para que você decida se é realmente um novo cadastro ou um enriquecimento do registro existente.</p>
    `,
  },
  {
    title: 'Etiquetas (TAGs) — Segmentação Visual',
    content: `
      <p>As TAGs são a forma principal de categorizar e segmentar contatos na grid. Aparecem inline em cada linha, com cores semânticas.</p>
      <ul>
        <li><b>Adicionar TAG:</b> clique no ícone <b>+</b> ao lado das TAGs na linha do contato.</li>
        <li><b>Filtrar por TAG:</b> clique na TAG diretamente na grid ou use o filtro avançado.</li>
        <li><b>Excluir TAG:</b> no filtro avançado, selecione TAGs a excluir para ver contatos <i>sem</i> aquelas etiquetas.</li>
      </ul>
      <p>Categorias sugeridas de TAGs:</p>
      <ul>
        <li><b>Relacionamento:</b> Cliente, Oposto, Parceiro, Testemunha, Perito.</li>
        <li><b>Status de Lead:</b> Novo, Qualificado, Perdido.</li>
        <li><b>Origem:</b> WhatsApp, Indicação, Site, Importado.</li>
      </ul>
    `,
  },
  {
    title: 'Identidade Multicanal — WhatsApp, LID e Telefone',
    content: `
      <p>O DR.X unifica identidades de diferentes canais no mesmo contato:</p>
      <ul>
        <li><b>WhatsApp JID:</b> número no formato <code style="background:#1e293b;padding:1px 4px;border-radius:3px">5531999887777@s.whatsapp.net</code>.</li>
        <li><b>LID:</b> identificador interno do WhatsApp (começa com números e termina em <code style="background:#1e293b;padding:1px 4px;border-radius:3px">@lid</code>). Vinculado automaticamente ao primeiro contato localizado pelo telefone.</li>
        <li><b>9º Dígito:</b> o sistema busca por todas as variantes (com e sem 9º dígito) para não perder correspondência por diferença de formato.</li>
      </ul>
      <p>O ícone <b>WhatsApp verde pulsante</b> na grid indica que o contato teve atividade recente no canal.</p>
      <p>Use o botão <b>"Sync WhatsApp"</b> no perfil do contato para forçar a verificação do número e vincular o LID correto.</p>
    `,
  },
  {
    title: 'Atalhos de Teclado',
    content: `
      <ul>
        <li><b>F1</b> ou <b>Ctrl+F1</b>: abre este manual.</li>
        <li><b>N</b>: novo contato (quando não há campo de texto ativo).</li>
        <li><b>ESC</b>: fecha modais e cancela a ação atual.</li>
        <li><b>Duplo clique</b>: abre o perfil completo do contato.</li>
      </ul>
    `,
  },
];
