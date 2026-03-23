export type SystemTemplatePreferredStorage = 'WORD_ONLINE' | 'GOOGLE_DOCS';

export type SystemTemplateSeed = {
  systemKey: string;
  title: string;
  description?: string;
  tags?: string[];
  preferredStorage?: SystemTemplatePreferredStorage;
  content: string;
  metadata?: Record<string, any>;
};

const join = (parts: string[]) => parts.join('\n');

export const SYSTEM_TEMPLATE_SEEDS: SystemTemplateSeed[] = [
  {
    systemKey: 'PROCURACAO_GERAL',
    title: 'Procuração (Geral)',
    description:
      'Modelo padrão de procuração. Ajuste poderes específicos conforme o caso e a praxe local.',
    tags: ['Procuração', 'Sistema'],
    preferredStorage: 'WORD_ONLINE',
    content: join([
      `<h1 style="text-align:center;">PROCURAÇÃO</h1>`,
      `<p><strong>OUTORGANTE:</strong> {{contact.name}}, CPF/CNPJ {{contact.document}}, endereço {{contact.address.full}}.</p>`,
      `<p><strong>OUTORGADO(S):</strong> {{user.name}}, advogado(a), OAB {{user.oab}}.</p>`,
      `<p><strong>PODERES:</strong> confere poderes para o foro em geral, com cláusula <em>ad judicia</em> e <em>ad extra</em>, podendo praticar todos os atos necessários ao fiel cumprimento do mandato.</p>`,
      `<p>{{current.city}}, {{today.fullDate}}.</p>`,
      `<p>________________________________________</p>`,
      `<p>{{contact.name}}</p>`,
    ]),
    metadata: {
      sections: [{ title: 'Poderes', help: 'Confirme poderes especiais quando necessário.' }],
      internalComments: ['Verificar se precisa de poderes especiais (receber, dar quitação, transigir).'],
      blocks: [{ id: 'b_poderes', type: 'subtitle', title: 'Poderes' }],
    },
  },
  {
    systemKey: 'PETICAO_INICIAL_GENERIC',
    title: 'Petição Inicial (Genérica)',
    description: 'Baseada no Art. 319 do CPC. Use para ações de rito comum.',
    tags: ['Cível', 'CPC', 'Petição', 'Sistema'],
    preferredStorage: 'WORD_ONLINE',
    content: join([
      `<h1 style="text-align:center;">PETIÇÃO INICIAL</h1>`,
      `<p><strong>Processo nº:</strong> {{process.cnj}}</p>`,
      `<p><strong>Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(a) de Direito</strong></p>`,
      `<p>{{process.vars}} Vara - {{process.district}}/{{process.uf}}</p>`,
      `<hr/>`,
      `<p><strong>{{contact.name}}</strong>, CPF/CNPJ {{contact.document}}, e-mail {{contact.email}}, telefone {{contact.phone}}, endereço {{contact.address.full}}, vem, por seu advogado, propor a presente ação em face de <strong>{{opposing.name}}</strong>, CPF/CNPJ {{opposing.document}}, endereço {{opposing.address.full}}, pelos fatos e fundamentos a seguir.</p>`,
      `<h2>Dos Fatos</h2>`,
      `<p>{{DOS_FATOS}}</p>`,
      `<h2>Do Direito</h2>`,
      `<p>{{DO_DIREITO}}</p>`,
      `<h2>Dos Pedidos</h2>`,
      `<ol><li>{{PEDIDO_1}}</li><li>{{PEDIDO_2}}</li><li>{{PEDIDO_3}}</li></ol>`,
      `<p><strong>Valor da causa:</strong> {{process.value}}</p>`,
      `<p>{{current.city}}, {{today.fullDate}}.</p>`,
      `<p>________________________________________</p>`,
      `<p>{{user.name}}<br/>OAB: {{user.oab}}</p>`,
    ]),
    metadata: {
      sections: [
        { title: 'Dos Fatos', help: 'Descreva o ocorrido com clareza e cronologia.' },
        { title: 'Do Direito', help: 'Fundamente com base legal e jurisprudência aplicável.' },
        { title: 'Dos Pedidos', help: 'Liste pedidos de forma objetiva e numerada.' },
      ],
      internalComments: ['Verificar pedido de Justiça Gratuita', 'Checar competência e valor da causa'],
      blocks: [
        { id: 'b_fatos', type: 'subtitle', title: 'Dos Fatos' },
        { id: 'b_direito', type: 'subtitle', title: 'Do Direito' },
        { id: 'b_pedidos', type: 'subtitle', title: 'Dos Pedidos' },
        { id: 'b_jg', type: 'textBox', title: 'Justiça Gratuita', help: 'Marcar se cabível, anexar documentos.' },
      ],
    },
  },
  {
    systemKey: 'CONTESTACAO_GENERIC',
    title: 'Contestação (Genérica)',
    description: 'Estrutura base de contestação (CPC). Ajuste preliminares e mérito conforme o caso.',
    tags: ['Cível', 'CPC', 'Contestação', 'Sistema'],
    preferredStorage: 'WORD_ONLINE',
    content: join([
      `<h1 style="text-align:center;">CONTESTAÇÃO</h1>`,
      `<p><strong>Processo nº:</strong> {{process.cnj}}</p>`,
      `<p><strong>Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(a) de Direito</strong></p>`,
      `<p>{{process.vars}} Vara - {{process.district}}/{{process.uf}}</p>`,
      `<hr/>`,
      `<p><strong>{{contact.name}}</strong>, já qualificado(a), por seu advogado, apresenta CONTESTAÇÃO à ação proposta por <strong>{{opposing.name}}</strong>, pelos fundamentos a seguir.</p>`,
      `<h2>Preliminares</h2>`,
      `<p>{{PRELIMINARES}}</p>`,
      `<h2>Mérito</h2>`,
      `<p>{{MERITO}}</p>`,
      `<h2>Pedidos</h2>`,
      `<ol><li>{{PEDIDO_1}}</li><li>{{PEDIDO_2}}</li></ol>`,
      `<p>{{current.city}}, {{today.fullDate}}.</p>`,
      `<p>________________________________________</p>`,
      `<p>{{user.name}}<br/>OAB: {{user.oab}}</p>`,
    ]),
    metadata: {
      sections: [
        { title: 'Preliminares', help: 'Liste preliminares e matérias processuais pertinentes.' },
        { title: 'Mérito', help: 'Enfrente fatos e direito; impugne documentos e alegações.' },
      ],
      internalComments: ['Checar prazo de contestação', 'Verificar necessidade de reconvenção'],
      blocks: [
        { id: 'b_prelim', type: 'subtitle', title: 'Preliminares' },
        { id: 'b_merito', type: 'subtitle', title: 'Mérito' },
      ],
    },
  },
  {
    systemKey: 'DECLARACAO_HIPOSSUFICIENCIA',
    title: 'Declaração de Hipossuficiência',
    description: 'Declaração para fins de justiça gratuita. Ajuste conforme o caso concreto.',
    tags: ['Justiça Gratuita', 'CPC', 'Sistema'],
    preferredStorage: 'WORD_ONLINE',
    content: join([
      `<h1 style="text-align:center;">DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h1>`,
      `<p>Eu, <strong>{{contact.name}}</strong>, CPF/CNPJ {{contact.document}}, residente e domiciliado(a) em {{contact.address.full}}, DECLARO, para os devidos fins, que não possuo condições de arcar com as custas processuais e honorários advocatícios sem prejuízo do meu sustento e de minha família.</p>`,
      `<p>Declaro, ainda, estar ciente das penas da lei em caso de falsidade.</p>`,
      `<p>{{current.city}}, {{today.fullDate}}.</p>`,
      `<p>________________________________________</p>`,
      `<p>{{contact.name}}</p>`,
    ]),
    metadata: {
      sections: [{ title: 'Declaração', help: 'Confirme a necessidade de justiça gratuita.' }],
      internalComments: ['Verificar documentos de renda antes de anexar.'],
      blocks: [{ id: 'b_decl', type: 'textBox', title: 'Observações', help: 'Notas internas do escritório.' }],
    },
  },
];

