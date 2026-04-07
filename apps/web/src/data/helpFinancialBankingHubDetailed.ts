import type { HelpSection } from "../components/HelpModal";

export const helpFinancialBankingHubDetailed: HelpSection[] = [
  {
    title: "Visao Geral (Financeiro + Banking Hub)",
    content: `
      <p>O <b>Financeiro</b> do Dr.X controla contas a pagar, contas a receber, baixas, conciliacao operacional e contas bancarias internas. A area <b>Banking Hub</b> conecta o financeiro ao banco para reduzir retrabalho, melhorar a conciliacao e deixar o processo mais seguro.</p>
      <p><b>Ordem por banco no manual:</b> hoje o primeiro banco operacional documentado e o <b>Banco Inter</b>. Os proximos bancos devem seguir a mesma estrutura: preparo no banco, preparo no Dr.X, teste, sincronizacao, webhook, conciliacao e checklist final.</p>
      <img src="/help/financial/financial-banking-overview.svg" alt="Visao geral do Banking Hub" style="width:100%;max-width:920px;border-radius:14px;border:1px solid rgba(148,163,184,.18);margin:12px 0;" />
      <ul>
        <li><b>No Banco:</b> voce cria a integracao, aceita permissoes, baixa certificados/chaves e ativa o que for necessario.</li>
        <li><b>No Dr.X:</b> voce cadastra a integracao, vincula a conta bancaria interna, testa a conexao, sincroniza e faz a conciliacao.</li>
        <li><b>Resultado esperado:</b> mais controle, menos digitacao manual e trilha operacional mais confiavel.</li>
      </ul>
    `,
  },
  {
    title: "Banco Inter - Antes de Comecar",
    content: `
      <p>Antes de abrir o cadastro no Dr.X, organize o que sera usado na integracao do <b>Banco Inter</b>.</p>
      <img src="/help/financial/financial-inter-checklist.svg" alt="Checklist de preparacao Banco Inter" style="width:100%;max-width:920px;border-radius:14px;border:1px solid rgba(148,163,184,.18);margin:12px 0;" />
      <ul>
        <li><b>Conta PJ ativa no Inter.</b> A integracao empresarial deve nascer na conta correta.</li>
        <li><b>Acesso ao Internet Banking.</b> O portal oficial informa login pelo QR Code e criacao da integracao pelo menu de solucoes empresariais.</li>
        <li><b>Responsavel definido.</b> Idealmente uma unica pessoa deve conduzir a ativacao e guardar o historico das credenciais.</li>
        <li><b>Conta bancaria interna ja cadastrada no Dr.X.</b> A integracao precisa ser vinculada a uma conta da tela <b>Contas Bancarias</b>.</li>
        <li><b>Plano de ambiente.</b> Comece em <b>Sandbox</b>, valide o processo inteiro e so depois avance para <b>Producao</b>.</li>
        <li><b>Certificado e segredo protegidos.</b> Nunca envie Client Secret, certificado A1 ou senha por WhatsApp, e-mail comum ou grupo.</li>
      </ul>
      <p><b>Fontes oficiais do Inter:</b><br/>
        <a href="https://developers.inter.co/" target="_blank" rel="noreferrer">Portal do Desenvolvedor Inter</a><br/>
        <a href="https://developers.inter.co/docs/sandbox" target="_blank" rel="noreferrer">Ambiente Sandbox</a><br/>
        <a href="https://developers.inter.co/docs/configurando-postman-testes/como-utilizar-token-apis-inter" target="_blank" rel="noreferrer">Guia oficial de integracao e token</a>
      </p>
    `,
  },
  {
    title: "Banco Inter - Passo a Passo no Banco",
    content: `
      <p>Este e o fluxo operacional do lado do <b>Banco Inter</b>, com base no portal oficial.</p>
      <ol>
        <li><b>Entrar no Internet Banking.</b> O portal do Inter informa login via <b>QR Code</b>.</li>
        <li><b>Criar uma nova integracao.</b> No Internet Banking, acesse <b>Solucoes para sua empresa</b> e clique em <b>Nova Integracao</b>.</li>
        <li><b>Dar um nome claro para a integracao.</b> Exemplo: <code>DRX Financeiro Sandbox</code> ou <code>DRX Financeiro Producao</code>.</li>
        <li><b>Selecionar as permissoes necessarias.</b> Para o escopo atual do Dr.X, priorize extrato, saldos, cobranca, Pix cobranca, Pix pagamento e eventos relacionados.</li>
        <li><b>Salvar e concluir a criacao.</b></li>
        <li><b>Baixar chaves e certificado.</b> O Inter informa que, apos a criacao, voce sera levado a area de integracoes para baixar chaves e certificados e ativar a integracao.</li>
        <li><b>Ativar o que foi gerado.</b> Sem ativacao correta, o Dr.X nao conseguira testar nem autenticar a integracao.</li>
        <li><b>Guardar os arquivos com seguranca.</b> Mantenha tudo em pasta restrita ou cofre corporativo, nunca em area publica do computador.</li>
      </ol>
      <p><b>Recomendacao operacional:</b> mantenha duas integracoes separadas, uma para <b>Sandbox</b> e outra para <b>Producao</b>. Isso reduz risco de mistura entre teste e operacao real.</p>
      <img src="/help/financial/financial-inter-onboarding.svg" alt="Fluxo de ativacao Banco Inter e Dr.X" style="width:100%;max-width:920px;border-radius:14px;border:1px solid rgba(148,163,184,.18);margin:12px 0;" />
    `,
  },
  {
    title: "Banco Inter - Passo a Passo no Dr.X",
    content: `
      <p>Depois que a integracao estiver criada no banco, faca o cadastro no Dr.X.</p>
      <ol>
        <li>Acesse <b>Financeiro</b>.</li>
        <li>Entre na aba <b>Banking Hub</b>.</li>
        <li>Se ainda nao houver integracao, use <b>Conectar Banco Inter</b>. Se ja existir, use <b>Nova Integracao</b>.</li>
        <li>Escolha primeiro o ambiente <b>Sandbox</b>.</li>
        <li>Vincule a <b>Conta bancaria interna</b> correta.</li>
        <li>Preencha as credenciais e dados da conta.</li>
        <li>Salve a integracao.</li>
        <li>Clique em <b>Testar</b> para validar o cadastro e a saude da conexao.</li>
        <li>Se o teste estiver consistente, clique em <b>Sincronizar</b> para iniciar leitura de saldo e transacoes.</li>
        <li>Revise a lista importada e use <b>Conciliar</b> quando houver correspondencia com titulos internos.</li>
      </ol>
      <p><b>Regra simples:</b> nao avance para Producao antes de o fluxo em Sandbox estar repetivel, documentado e claro para a equipe.</p>
    `,
  },
  {
    title: "Banco Inter - Preenchimento Campo a Campo",
    content: `
      <p>Na janela <b>Nova Integracao Banco Inter</b> ou <b>Editar Integracao Banco Inter</b>, use esta leitura rapida.</p>
      <ul>
        <li><b>Nome da integracao:</b> use um nome operacional claro. Exemplo: <code>Banco Inter - Matriz - Sandbox</code>.</li>
        <li><b>Ambiente:</b> <b>Sandbox</b> para teste e <b>Producao</b> para operacao real.</li>
        <li><b>Conta bancaria interna:</b> conta do Dr.X que recebera saldo, sync e conciliacao desta integracao.</li>
        <li><b>External Account ID:</b> identificador externo da conta no banco, quando aplicavel.</li>
        <li><b>Titular:</b> nome do titular da conta no banco.</li>
        <li><b>Documento do titular:</b> CPF ou CNPJ do titular, sem improviso.</li>
        <li><b>Agencia:</b> informe a agencia exatamente como usada pelo banco.</li>
        <li><b>Conta:</b> numero da conta vinculada a integracao.</li>
        <li><b>Client ID:</b> identificador da aplicacao/integracao fornecido pelo Inter.</li>
        <li><b>Client Secret:</b> segredo da integracao. Trate como senha de banco.</li>
        <li><b>Certificado A1 em Base64:</b> campo para colar o conteudo convertido do arquivo A1.</li>
        <li><b>Senha do certificado:</b> senha real do certificado A1.</li>
        <li><b>Token URL customizada:</b> normalmente deixe em branco, a menos que a equipe tecnica precise apontar rota especifica por motivo controlado.</li>
        <li><b>Webhook - Ativar:</b> habilite somente quando o endpoint da empresa estiver pronto para receber eventos de forma segura.</li>
        <li><b>URL do webhook:</b> endereco publico HTTPS que recebera os eventos do banco.</li>
        <li><b>Segredo do webhook:</b> segredo usado para validacao dos eventos recebidos.</li>
      </ul>
      <p><b>Dica de governanca:</b> uma integracao por conta e por ambiente. Evite reaproveitar a mesma integracao para multiplas contas ou misturar teste e producao.</p>
    `,
  },
  {
    title: "Banco Inter - Exemplos para Copiar e Colar",
    content: `
      <p>Use estes exemplos como base operacional. Ajuste com seus dados reais.</p>
      <p><b>Nomes de integracao</b></p>
      <pre><code>Banco Inter - Matriz - Sandbox
Banco Inter - Matriz - Producao
Banco Inter - Filial BH - Sandbox
Banco Inter - Filial BH - Producao</code></pre>
      <p><b>Exemplo de URL de webhook</b></p>
      <pre><code>https://api.dr-x.xtd.com.br/banking/webhooks/inter</code></pre>
      <p><b>Exemplo de anotacao interna da equipe</b></p>
      <pre><code>Banco: Inter
Conta: Matriz
Ambiente: Sandbox
Responsavel: Financeiro + TI
Data de ativacao: 2026-04-07
Escopo: saldo, extrato, cobranca, pix, webhook</code></pre>
      <p><b>PowerShell: converter certificado A1 (.pfx/.p12) para Base64 e copiar para a area de transferencia</b></p>
      <pre><code>[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\\certificados\\inter-certificado.pfx")) | Set-Clipboard</code></pre>
      <p><b>PowerShell: gerar arquivo TXT com o Base64</b></p>
      <pre><code>[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\\certificados\\inter-certificado.pfx")) | Out-File -Encoding ascii "C:\\certificados\\inter-certificado-base64.txt"</code></pre>
      <p><b>Observacao:</b> se o certificado estiver em <code>.p12</code>, o comando e o mesmo; apenas troque a extensao do arquivo.</p>
    `,
  },
  {
    title: "Banco Inter - Testar, Sincronizar e Conciliar",
    content: `
      <p>Depois do cadastro salvo, a rotina recomendada no Dr.X e:</p>
      <ol>
        <li><b>Testar</b>: valida se a integracao esta minimamente configurada e pronta para o proximo passo.</li>
        <li><b>Sincronizar</b>: importa saldo e movimentacoes disponiveis da integracao bancaria.</li>
        <li><b>Revisar transacoes</b>: confira descricao, valor, data, origem e status.</li>
        <li><b>Conciliar</b>: vincule a transacao bancaria ao titulo do financeiro quando houver correspondencia.</li>
      </ol>
      <p><b>Leitura pratica dos indicadores da tela:</b></p>
      <ul>
        <li><b>Status:</b> mostra a situacao geral da integracao cadastrada.</li>
        <li><b>Saude:</b> ajuda a entender se a integracao passou no teste mais recente.</li>
        <li><b>Ultimo sync:</b> informa quando a sincronizacao foi executada pela ultima vez.</li>
        <li><b>Transacoes, Conciliacoes e Webhooks:</b> ajudam a medir se a rotina operacional esta andando.</li>
      </ul>
      <p><b>Rotina recomendada:</b> testar quando houver mudanca de credencial, sincronizar no inicio e no fim do dia, e conciliar pendencias antes do fechamento financeiro.</p>
    `,
  },
  {
    title: "Banco Inter - Webhook, Seguranca e Eficiencia",
    content: `
      <p>O webhook e a ponte para automacao de eventos bancarios, mas deve ser habilitado com disciplina.</p>
      <ul>
        <li><b>Use HTTPS publico.</b> O banco precisa alcancar a URL de fora da sua rede.</li>
        <li><b>Defina um segredo exclusivo.</b> Nao repita a mesma senha usada em outros modulos.</li>
        <li><b>Restrinja quem pode editar a integracao.</b> Quanto menos gente com acesso, menor o risco.</li>
        <li><b>Troque credenciais de forma controlada.</b> Primeiro atualize no banco, depois no Dr.X, depois teste de novo.</li>
        <li><b>Nunca use copia e cola em ambiente inseguro.</b> Evite bloco de notas compartilhado, grupo de mensagens ou computador publico.</li>
        <li><b>Mantenha trilha operacional.</b> Registre quem criou, quem alterou, quando testou e quando colocou em producao.</li>
      </ul>
      <p><b>Recomendacao de simplicidade operacional:</b> uma pessoa da area financeira opera, uma pessoa tecnica valida. Isso reduz erro sem travar o processo.</p>
    `,
  },
  {
    title: "Banco Inter - Checklist Final de Homologacao",
    content: `
      <p>Considere a integracao pronta para uso controlado somente quando todos os itens abaixo estiverem claros.</p>
      <ul>
        <li><b>Banco:</b> integracao criada, permissoes aceitas, certificado e chaves baixados e ativados.</li>
        <li><b>Dr.X:</b> integracao salva, conta bancaria interna vinculada e ambiente correto selecionado.</li>
        <li><b>Seguranca:</b> Client Secret, certificado e senha guardados de forma restrita.</li>
        <li><b>Teste:</b> o botao <b>Testar</b> foi executado apos o preenchimento final.</li>
        <li><b>Sincronizacao:</b> ao menos uma sincronizacao foi rodada e conferida.</li>
        <li><b>Conciliacao:</b> a equipe conseguiu interpretar as transacoes e vincular os titulos certos.</li>
        <li><b>Webhook:</b> somente habilitado quando a equipe tecnica confirmar o endpoint publico e seguro.</li>
        <li><b>Producao:</b> liberada somente depois de o fluxo em Sandbox estar repetivel.</li>
      </ul>
      <p><b>Importante:</b> se houver duvida sobre credencial, certificado ou endpoint, interrompa a ativacao e valide com a equipe tecnica antes de seguir.</p>
    `,
  },
  {
    title: "Transacoes Simples, Parcelamentos e Liquidacao",
    content: `
      <p>Mesmo com integracao bancaria, o <b>Financeiro</b> continua sendo a base dos lancamentos internos.</p>
      <ol>
        <li>Clique em <b>Nova Transacao</b>.</li>
        <li>Escolha <b>Receita</b> ou <b>Despesa</b>.</li>
        <li>Informe valor, descricao, vencimento, partes envolvidas e demais campos necessarios.</li>
        <li>Se houver parcelamento, defina a quantidade de parcelas. O Dr.X gera o pai e as filhas.</li>
        <li>Para <b>Liquidar</b>, use o icone da calculadora verde e informe juros, multa, correcao, desconto, forma de pagamento e conta bancaria.</li>
      </ol>
      <p><b>Dica:</b> faca a liquidacao com a conta bancaria correta. Isso melhora a conciliacao e evita acerto manual depois.</p>
    `,
  },
  {
    title: "Contas Bancarias Internas",
    content: `
      <p>A visao <b>Contas Bancarias</b> do Financeiro representa o mapa interno do dinheiro no Dr.X: banco real, caixa, cofre ou conta de operacao.</p>
      <ul>
        <li>Cadastre uma conta para cada operacao relevante.</li>
        <li>Use nomes claros, por exemplo: <code>Banco Inter - Matriz</code>, <code>Caixa Interno</code>, <code>Cofre</code>.</li>
        <li>Ao liquidar uma transacao, o valor entra ou sai da conta selecionada.</li>
        <li>No Banking Hub, a integracao bancaria deve apontar para a conta interna correta.</li>
      </ul>
      <p><b>Regra simples:</b> conta errada no cadastro costuma virar conciliacao errada depois.</p>
    `,
  },
  {
    title: "Filtro por Periodo (Livre e Manual)",
    content: `
      <p>O seletor global de periodo foi aprimorado para dar <b>liberdade total</b> de datas. Agora voce pode definir qualquer intervalo, inclusive periodos longos como <b>79 dias</b>, <b>4 meses</b> ou recortes totalmente personalizados.</p>
      <ul>
        <li><b>Data inicial:</b> dia, mes e ano livres.</li>
        <li><b>Data final:</b> dia, mes e ano livres.</li>
        <li><b>Digitacao manual:</b> voce pode escrever a data diretamente no campo.</li>
        <li><b>Formatos aceitos:</b> <code>dd/mm/aaaa</code> e <code>aaaa-mm-dd</code>.</li>
        <li><b>Uso combinado:</b> combine com status, valor, categoria, tags e conta bancaria para refinar o resultado.</li>
      </ul>
      <p>No Financeiro, voce pode filtrar por:</p>
      <ul>
        <li><b>Periodo de lancamento</b>: quando o registro foi criado.</li>
        <li><b>Periodo de vencimento</b>: quando a conta vence.</li>
        <li><b>Periodo de pagamento</b>: quando a conta foi efetivamente liquidada.</li>
      </ul>
      <p><b>Dica operacional:</b> ao fechar caixa ou conferir banco, use periodo de pagamento; ao cobrar clientes, use periodo de vencimento.</p>
    `,
  },
  {
    title: "Agilidade Financeira",
    content: `
      <ul>
        <li><b>F2 ou +</b>: abre rapidamente uma nova transacao.</li>
        <li><b>ESC</b>: fecha modais e cancela o que estiver aberto.</li>
        <li><b>Duplo clique</b>: abre rapidamente o registro para edicao.</li>
        <li><b>Salvar</b> vs <b>Salvar e sair</b>: use <b>Salvar</b> quando ainda estiver ajustando o registro.</li>
        <li><b>Rotina diaria recomendada:</b> conferir vencimentos, liquidar o que foi pago, sincronizar banco e conciliar pendencias.</li>
      </ul>
    `,
  },
];
