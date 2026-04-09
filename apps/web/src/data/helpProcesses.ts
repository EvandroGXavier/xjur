import type { HelpSection } from "../components/HelpModal";

const imageStyle =
  "width:100%;max-width:920px;border-radius:14px;border:1px solid rgba(148,163,184,.18);margin:12px 0;";

const helpImage = (src: string, alt: string) =>
  `<img src="${src}" alt="${alt}" style="${imageStyle}" />`;

export const helpProcesses: HelpSection[] = [
  {
    title: "Manual pratico da Importacao de Processos",
    content: `
      <p>Este manual foi pensado para ser um <b>guia de uso real</b>. Se voce seguir a sequencia abaixo, conseguira importar um processo por PDF com mais previsibilidade, menos retrabalho e melhor revisao do que foi preenchido automaticamente.</p>
      <p><b>Regra principal do modulo hoje:</b> quando o PDF ja traz as informacoes do processo, o sistema prioriza o proprio PDF e evita consulta desnecessaria ao CNJ nesta etapa.</p>
      ${helpImage("/help/processes/process-import-overview.svg", "Fluxo pratico da importacao por PDF")}
      <ul>
        <li><b>No novo processo:</b> o PDF faz o <b>pre-cadastro</b> e preenche a base inicial para voce revisar antes de salvar.</li>
        <li><b>No processo ja salvo:</b> o PDF pode alimentar o <b>dossie</b>, andamentos e leitura operacional do caso.</li>
        <li><b>Resultado esperado:</b> menos digitacao manual, mais dados das partes e mais coerencia entre a aba TJ, Partes e Andamentos.</li>
      </ul>
    `,
  },
  {
    title: "Qual fluxo usar: Pre-cadastro x Dossie do processo",
    content: `
      <p>Existem dois usos diferentes para o mesmo botao de importacao. O segredo para nao se frustrar e escolher o fluxo certo.</p>
      ${helpImage("/help/processes/process-import-preview-vs-dossier.svg", "Comparacao entre pre-cadastro e dossie do processo")}
      <ul>
        <li><b>Pre-cadastro:</b> use em <b>Processos &gt; Novo Processo</b>. O sistema le a capa, identifica tribunal/sistema, tenta montar as partes e traz qualificacoes iniciais para revisao antes do salvamento.</li>
        <li><b>Dossie do processo:</b> use quando o processo <b>ja existe</b> no sistema. Aqui o objetivo e aprofundar a leitura do PDF e importar andamentos, resumo operacional e outros dados do proprio processo.</li>
        <li><b>Decisao pratica:</b> se voce ainda esta criando o cadastro, comece pelo <b>pre-cadastro</b>. Se o processo ja foi salvo e voce quer enriquecer timeline e leitura do caso, use o <b>dossie</b>.</li>
      </ul>
    `,
  },
  {
    title: "PJe: o que a primeira pagina ja entrega",
    content: `
      <p>No PJe, a <b>primeira pagina</b> costuma ser suficiente para preencher grande parte da aba <b>TJ</b>. Isso reduz custo, leitura desnecessaria e tempo de espera.</p>
      ${helpImage("/help/processes/process-import-pje-first-page.svg", "Campos tipicos encontrados na primeira pagina do PJe")}
      <p><b>O que normalmente sai da capa do PJe:</b></p>
      <ul>
        <li><b>CNJ</b>, <b>classe</b>, <b>orgao julgador</b>, <b>distribuicao</b>, <b>valor da causa</b> e <b>assuntos</b>.</li>
        <li><b>Partes e advogados</b> da capa, que ajudam a iniciar a classificacao na aba <b>Partes</b>.</li>
        <li><b>Lista inicial de documentos</b>, usada pelo sistema para decidir quando vale a pena aprofundar a leitura.</li>
      </ul>
      <p><b>Leitura objetiva:</b> quando a capa do PJe ja esta completa, o sistema deve preencher primeiro a aba <b>TJ</b> e so aprofundar o restante do PDF quando houver ganho real para as partes, qualificacoes ou timeline.</p>
    `,
  },
  {
    title: "Passo a passo: Novo Processo -> Importar PDF",
    content: `
      <ol>
        <li>Acesse <b>Processos</b> e clique em <b>Novo Processo</b>.</li>
        <li>Na tela inicial, clique em <b>Importar PDF (pre-cadastro)</b>.</li>
        <li>Selecione o PDF do processo. Em arquivos maiores, acompanhe a caixa <b>Etapa atual</b> enquanto o sistema trabalha.</li>
        <li>Quando a leitura terminar, revise primeiro a aba <b>TJ</b>: tribunal, sistema, classe, vara, comarca, distribuicao, magistrado e valor.</li>
        <li>Depois revise a aba <b>Partes</b>: nomes, papeis, marcacao de cliente/contrario e dados de qualificacao.</li>
        <li>Se o titulo do caso ainda estiver generico, ajuste o campo <b>Titulo / Nome do Caso</b>.</li>
        <li>So entao clique em <b>Salvar Tudo</b>.</li>
      </ol>
      <p><b>Resultado esperado:</b> voce sai do PDF para um cadastro quase pronto, com menos digitacao e com uma revisao final humana antes do salvamento.</p>
    `,
  },
  {
    title: "Passo a passo: Processo salvo -> Importar PDF do processo",
    content: `
      <ol>
        <li>Abra um processo que ja esteja salvo no sistema.</li>
        <li>Na aba <b>Principal</b>, localize o bloco <b>PDF Integral do Processo</b>.</li>
        <li>Clique em <b>Importar PDF do processo</b>.</li>
        <li>Acompanhe a <b>Etapa atual</b> para saber se o sistema esta lendo capa, separando documentos ou consolidando a timeline.</li>
        <li>Ao final, confira o resumo de importacao e revise a aba <b>Andamentos</b>.</li>
        <li>Se necessario, ajuste as partes e complemente a classificacao antes de seguir com a operacao do caso.</li>
      </ol>
      <p><b>Quando usar este fluxo:</b> quando o objetivo nao e mais criar o cadastro, e sim enriquecer o processo ja existente com leitura operacional do PDF.</p>
    `,
  },
  {
    title: "De onde vem a qualificacao das partes",
    content: `
      <p>O nome da parte sozinho quase nunca e suficiente. Por isso o sistema tenta buscar mais informacoes nas pecas certas do PDF, em vez de depender apenas da capa.</p>
      <ul>
        <li><b>Peticao inicial:</b> normalmente e a melhor fonte para nome completo, documento, estado civil, profissao, endereco e outras qualificacoes.</li>
        <li><b>Contestacao:</b> quando existir, pode complementar ou corrigir informacoes da parte contraria.</li>
        <li><b>Demais documentos:</b> o sistema so deve aprofundar a leitura quando houver ganho claro. A ideia nao e varrer 100% do PDF sem necessidade.</li>
      </ul>
      <p><b>Importante:</b> na importacao por PDF, o sistema <b>nao deve consultar o CNJ para substituir esses dados</b>. O proprio PDF costuma ser mais rico para partes e qualificacao.</p>
    `,
  },
  {
    title: "O que revisar antes de salvar",
    content: `
      <p>Revise sempre estes pontos antes de concluir a importacao ou salvar o processo:</p>
      ${helpImage("/help/processes/process-import-review-checklist.svg", "Checklist de revisao da importacao")}
      <ul>
        <li><b>Aba TJ:</b> CNJ, tribunal, sistema, classe, vara, comarca, distribuicao e valor da causa.</li>
        <li><b>Aba Partes:</b> nome correto, papel correto, marcacao de cliente/contrario e qualificacao util.</li>
        <li><b>Aba Andamentos:</b> veja se a leitura trouxe fatos uteis ou se ainda falta o dossie integral.</li>
        <li><b>Titulo do caso:</b> deixe claro para a equipe. Evite titulos vagos como apenas "Processo novo".</li>
      </ul>
      <p><b>Se algo importante nao veio:</b> salve apenas quando o minimo operacional estiver coerente e, se preciso, rode depois a importacao do dossie no processo ja salvo.</p>
    `,
  },
  {
    title: "Exemplos praticos de uso",
    content: `
      <p><b>Exemplo 1 - PJe com capa completa:</b> o PDF ja mostra CNJ, classe, orgao julgador, distribuicao, valor da causa, partes e lista de documentos. Nesse caso, o <b>pre-cadastro</b> costuma bastar para preencher a aba <b>TJ</b> e montar a primeira revisao das partes.</p>
      <p><b>Exemplo 2 - PDF grande com inicial e contestacao:</b> use o <b>pre-cadastro</b> para criar rapido o processo e, depois de salvar, rode o <b>dossie</b> para aprofundar qualificacao, timeline e leitura operacional.</p>
      <p><b>Exemplo 3 - Usuario quer apenas acompanhar andamentos:</b> se o processo ja existe, nao recrie o cadastro. Abra o processo salvo e use <b>Importar PDF do processo</b>.</p>
      <p><b>Exemplo de resultado esperado na tela:</b></p>
      <pre><code>Aba TJ preenchida
Partes separadas para revisao
Qualificacoes iniciais quando encontradas
Resumo final da importacao
Andamentos importados quando o processo ja estiver salvo</code></pre>
    `,
  },
  {
    title: "CNJ / DataJud: complemento, nao ponto de partida obrigatorio",
    content: `
      <p>O modulo continua tendo recursos de consulta judicial, mas o uso correto mudou:</p>
      <ul>
        <li><b>PDF-first:</b> quando voce ja tem o PDF dos autos, ele e a fonte principal para capa, partes, qualificacao e leitura do caso.</li>
        <li><b>CNJ / DataJud:</b> entram como <b>complemento</b>, especialmente para conferir disponibilidade oficial de andamentos ou operar sincronizacoes fora do PDF.</li>
        <li><b>Regra pratica:</b> nao use consulta externa para repetir informacao que o PDF ja entregou melhor.</li>
      </ul>
      <p>Isso melhora a performance, reduz custo e evita perder dados de qualificacao que normalmente nao aparecem na consulta resumida do CNJ.</p>
    `,
  },
  {
    title: "Problemas comuns e solucao rapida",
    content: `
      <ul>
        <li><b>O sistema parece parado:</b> confira a caixa <b>Etapa atual</b>. Em PDFs grandes, a leitura acontece por fases e a interface mostra em que ponto a importacao esta.</li>
        <li><b>Vieram poucas informacoes das partes:</b> veja se o PDF contem peticao inicial e, se houver, contestacao. Sao as pecas mais ricas para qualificacao.</li>
        <li><b>Aba TJ veio boa, mas faltou timeline:</b> isso e esperado no <b>pre-cadastro</b>. Salve o processo e rode o <b>dossie</b> depois.</li>
        <li><b>CNJ nao bate com o PDF:</b> priorize o PDF quando ele trouxer mais detalhe e use a consulta externa apenas como validacao complementar.</li>
        <li><b>Arquivo muito pesado:</b> aguarde o resumo final antes de repetir a importacao. Reenviar o mesmo arquivo sem necessidade so aumenta o retrabalho.</li>
      </ul>
    `,
  },
  {
    title: "Atalhos e produtividade",
    content: `
      <ul>
        <li><b>F1</b>: abre este manual da tela atual.</li>
        <li><b>F2</b>: abre um novo processo quando estiver na listagem.</li>
        <li><b>ESC</b>: fecha modais e cancela a acao atual.</li>
        <li><b>Duplo clique na grid</b>: abre o processo direto para edicao na listagem.</li>
      </ul>
      <p><b>Dica final:</b> use o manual como roteiro de trabalho. O fluxo mais seguro costuma ser: <b>importar -> revisar TJ -> revisar partes -> salvar -> importar dossie se precisar aprofundar</b>.</p>
    `,
  },
];
