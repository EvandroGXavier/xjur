
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const templateContent = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS
Pelo presente instrumento particular de contrato de prestação de serviços advocatícios, de um lado:

DAS PARTES
CONSTITUÍDO(S):
XAVIER XAVIER ADVOGADOS, pessoa jurídica de direito privado, inscrita no CNPJ sob Nº 58.361.863/0001-74, com sede na Rua da Bahia, 603 LOJA 09, Centro, Belo Horizonte, MG, CEP: 30.160-010, E-mail: xxavieradvogados@gmail.com, CHAVE PIX/CNPJ sob Nº 58.361.863/0001-74 . neste ato por seu representante legal: EVANDRO GERALDO XAVIER, brasileiro, advogado, OAB/MG 158 592,  Telefone:31-2534-7575, celular 31-99981-1174, E-mail: evandro@conectionmg.com.br, e o Dr. LEANDRO RIBEIRO XAVIER, brasileiro, advogado, OAB/MG 226 816,Telefone: 31-2534-7575, celular 31-97309-7037, E-mail: leandro.x@msn.com, doravante simplesmente denominado de CONSTITUÍDO, e de outro lado;
 

CONSTITUINTE(S):
[NOME_CLIENTE], [NACIONALIDADE_CLIENTE], [ESTADO_CIVIL_CLIENTE], [PROFISSAO_CLIENTE], inscrito no CPF Nº [CPF_CLIENTE], Inscrito no RG Nº [RG_CLIENTE], residente e domiciliado: [ENDERECO_CLIENTE], e-mail: [EMAIL_CLIENTE], data de nascimento: [NASCIMENTO_CLIENTE], filiação: [PAI_CLIENTE], [MAE_CLIENTE], doravante simplesmente denominado de CONSTITUINTE;

PJ
CONTRÁRIO(S): Razão Social: [NOME_ADVERSO], pessoa jurídica de direito privado, inscrita no CNPJ sob o Nº [CNPJ_ADVERSO], inscrição Estadual Nº [RG_ADVERSO], com sede na [ENDERECO_ADVERSO], doravante simplesmente denominado de Parte Adversa;

PF
CONTRÁRIO(S): [NOME_ADVERSO], [NACIONALIDADE_ADVERSO], [ESTADO_CIVIL_ADVERSO], [PROFISSAO_ADVERSO], inscrito no CPF Nº [CPF_ADVERSO], Inscrito no RG Nº [RG_ADVERSO], residente e domiciliado; [ENDERECO_ADVERSO], [EMAIL_ADVERSO], data de nascimento: [NASCIMENTO_ADVERSO], filiação: [PAI_ADVERSO], [MAE_ADVERSO], doravante simplesmente denominado de Parte Adversa;

 

DO OBJETO/VALORES/OBSERVAÇÕES

 
[OBSERVACAO_PROCESSO] 
 
 
DO OBJETO/VALORES/OBSERVAÇÕES
FATOS
(DETALHAR CLARAMENTE O QUE ACONTECEU)
OBJETO DO CONTRATO
Definição Detalhada sobre os Serviços Que serão Prestados
 
DOS HONORÁRIOS E CONDIÇÕES DE PAGAMENTO
O CONSTITUINTE pagará ao CONSTITUÍDO;

DESCRIÇÃO	VALOR	VENCIMENTO
Honorários Iniciais:	R$ XXX.000,00	Vencimento Neste ato
Honorários Mensais	R$ 250,00	Vencimento dia 15, Correção Anual, pelo IGM, Se for o caso
Honorários de Êxito	30% doValor Bruto	Sobre todo o proveito economico, da causa.
 	 	 
 
Pagará ao CONSTITUÍDO sobre o valor bruto recebido em caso de êxito, seja por sentença, acordo ou qualquer outro benefício econômico obtido em favor do CONSTITUINTE.
Multa por Atraso no pagamento: Em caso de atraso no pagamento dos honorários, o CONSTITUINTE pagará multa de 10% (dez por cento) sobre o valor devido, acrescido de juros de mora de 1% (um por cento) ao mês e atualização monetária com base no IGP-M/FGV.
Despesas Extras: Todas as despesas processuais, como custas judiciais, fotocópias, autenticações, locomoção, hospedagem, alimentação, e outras, deverão ser custeadas pelo CONSTITUINTE, podendo ser solicitadas antecipadamente, com prestação de contas posterior.
 

DAS OBRIGAÇÕES DO CONSTITUÍDO
O CONSTITUÍDO se compromete a:
Prestar seus serviços advocatícios com honestidade, zelo e diligência, em conformidade com o Código de Ética e Disciplina da OAB, bem como com o Estatuto da Advocacia (Lei nº 8.906/94).
Informar ao CONSTITUINTE sobre o andamento do processo sempre que solicitado, até a segunda instância, salvo pactuação posterior para outros recursos.
Praticar todos os atos necessários à defesa dos interesses do CONSTITUINTE perante órgãos públicos, repartições, tribunais e estabelecimentos particulares, conforme especificado no instrumento de procuração.
DAS OBRIGAÇÕES DO CONSTITUINTE
O CONSTITUINTE compromete-se a:
Pagar os honorários e custas processuais nos prazos e condições estabelecidos neste contrato.
Fornecer ao CONSTITUÍDO todos os documentos e informações necessárias à boa instrução do processo, dentro dos prazos estabelecidos.
Informar imediatamente ao CONSTITUÍDO qualquer mudança de endereço, telefone ou e-mail.
Cumprir fielmente todas as suas obrigações, sob pena de rescisão do contrato e revogação da procuração, caso haja ocultação de informações ou má-fé.
DA SUCUMBÊNCIA
Os honorários sucumbenciais, caso sejam fixados em favor do CONSTITUÍDO, pertencerão exclusivamente a este, sem prejuízo dos honorários convencionais já ajustados com o CONSTITUINTE.
DA VIGÊNCIA
Este contrato entra em vigor na data de sua assinatura e será válido até a conclusão de todos os atos necessários ao término do processo ou do último recurso, caso haja interesse das partes.
DA RESCISÃO E REVOGAÇÃO DO MANDATO
O presente contrato poderá ser rescindido de pleno direito nas seguintes hipóteses:
Por acordo entre as partes;
Pela revogação do mandato pelo CONSTITUINTE, sem culpa do CONSTITUÍDO;
Pelo não prosseguimento da ação por circunstância alheia à vontade do CONSTITUÍDO.
Em caso de rescisão sem culpa do CONSTITUÍDO, os honorários pactuados serão cobrados integralmente.
DA REPRESENTAÇÃO
O CONSTITUÍDO poderá designar outro(s) advogado(s) para representá-lo em qualquer ato processual, caso julgue necessário, sem prejuízo à defesa dos interesses do CONSTITUINTE.
DO FORO
As partes elegem o Foro da [COMARCA_PROCESSO]/[UF_PROCESSO] para dirimir quaisquer questões oriundas deste contrato, renunciando a qualquer outro, por mais privilegiado que seja.
E por estarem assim justos e contratados, assinam le presente instrumento em 02 (duas) vias de igual teor e forma, na presença de 02 (duas) testemunhas a seguir assinadas.
 

 [COMARCA_PROCESSO]/[UF_PROCESSO], [DATA_ATUAL].

 

 

 

[NOME_CLIENTE]

 

 
 
EVANDRO GERALDO XAVIER
OAB/MG 158 592           
 

TESTEMUNHAS:

Ass.:

NOME    
CPF:
 
 
Ass.:

NOME:      
CPF:
 
 
PROCURAÇÃO
 
 
OUTORGADO(S):
EVANDRO GERALDO XAVIER, brasileiro, advogado, OAB/MG 158 592, Escritório situado a Rua da Bahia, 603, loja 07, centro, CEP 30.160-010, Belo Horizonte/MG, Telefone:31-2534-7575, celular 31-99981-1174, E-mail: evandro@conectionmg.com.br, e o Dr. LEANDRO RIBEIRO XAVIER, brasileiro, advogado, OAB/MG 226 816, Escritório situado a Rua da Bahia, 603, loja 07, Centro, CEP 30.160-010, Belo Horizonte/MG, Telefone: 31-2534-7575, celular 31-97309-7037, E-mail: leandro.x@msn.com
 
OUTORGANTE(S):
[NOME_CLIENTE], [NACIONALIDADE_CLIENTE], [ESTADO_CIVIL_CLIENTE], [PROFISSAO_CLIENTE], inscrito no CPF Nº [CPF_CLIENTE], Inscrito no RG Nº [RG_CLIENTE], residente e domiciliado; [ENDERECO_CLIENTE], [EMAIL_CLIENTE], data de nascimento: [NASCIMENTO_CLIENTE], filiação: [PAI_CLIENTE], [MAE_CLIENTE],
 
P
O
D
E
R
E
S:
O(s) outorgante(s) nomeia(m) os outorgados seus procuradores, conferindo-lhes os poderes da cláusula "ad judicia" e "ad extra", conjunta ou separadamente, para representá-lo(s) em juízo ou fora dele, outorgando-lhes ainda os especiais poderes para receber citação, de concordar, acordar, confessar, discordar, desistir, transigir, firmar compromissos, reconhecer a procedência do pedido, renunciar ao direito sobre o qual se funda a ação, receber, dar quitação, executar e fazer cumprir decisions e títulos judiciais e extrajudiciais, receber valores e levantar alvarás judiciais extraídos em nome do outorgante, requerer falências e concordatas, imputar a terceiros, em nome dos outorgantes, fatos descritos como crimes, arguir exceções de suspeição, firmar compromisso e declarar hipossuficiência econômica, constituir preposto, substabelecer com ou sem reserva os poderes conferidos pelo presente mandato. Declara ainda, que tem ciência que o levantamento de créditos decorrentes de precatório ou RPV somente poderá ser efetivado mediante alvará judicial.
PODERES ESPECÍFICOS: Atuar em inventários ou areas especiais.

I
N
C
L
U
S
I
V
E
Representar os interesses do(s) outorgante(s) para promover, requerer, ou defender seus interesses como HERDEIRO e ou INVENTARIANTE no inventário de [DADOS_ADVERSO], Processo Nº [NUMERO_PROCESSO], podendo representá-lo em qualquer fase da gestão do espólio, inventário e partilha dos bens do falecido, para o qual poderá requerer e praticar todos os atos jurídicos, necessários, ao inventário, não somente, mas inclusive; 1)Abrir inventário e aceitar encargos de inventariante;2)Prestar declarações em todas as fases do processo;3)Impugnar e contestar a qualidade de herdeiros, inventariantes e suas contas;4)Aceitar, abravar ou impugnar avaliações;5)Firmar partilhas, amigáveis ou judiciais;6)Requerer adjudicações;7)Pagar impostos e taxas relacionadas;8)Assinar documentos, requerimentos e guias;9)Representar os outorgantes perante órgãos públicos e privados;10)E todos os demais atos que se fizerem necessários para o fiel cumprimento desta procuração e das necessidades do outorgante(s).
 

 

[COMARCA_PROCESSO]/[UF_PROCESSO], [DATA_ATUAL].

 

__________________________
[NOME_CLIENTE]

DECLARAÇÃO DE HIPOSSUFICIÊNCIA
 

 

Da Justiça Gratuita

 

DECLARANTE(S):
[NOME_CLIENTE], [NACIONALIDADE_CLIENTE], [ESTADO_CIVIL_CLIENTE], [PROFISSAO_CLIENTE], inscrito no CPF Nº [CPF_CLIENTE], Inscrito no RG Nº [RG_CLIENTE], residente e domiciliado; [ENDERECO_CLIENTE], [EMAIL_CLIENTE], data de nascimento: [NASCIMENTO_CLIENTE], filiação: [PAI_CLIENTE], [MAE_CLIENTE],
 

Venho através desta requerer a gratuidade de justiça, uma vez que necessito de acesso a justiça, e por não haver condição financeira para arcar com as  custas e despesas  processuais, sem prejuízo do sustento próprio  e familiar.

 

Amparado no art. 5º, inc. LXXIV da Constituição Federal, e nas disposições da Lei nº 13.105/2015 e 1.060/50, requerer a Vossa Excelência a concessão do benefício da gratuidade da justiça, uma vez que se encontra impossibilitado de prover as custas do processo e os honorários de advogado, sem prejuízo do sustento próprio e da família.

 

 

 

Nestes termos, Pede Deferimento.

 

[COMARCA_PROCESSO]/[UF_PROCESSO], [DATA_ATUAL].

 

 

__________________________
[NOME_CLIENTE]`;

async function main() {
  const tenantId = '0e168f4b-9aa5-4e66-b4c2-a25605f87903';
  const categoryName = 'Contratos e Procurações';
  
  let category = await prisma.documentCategory.findFirst({
    where: { tenantId, name: categoryName }
  });
  
  if (!category) {
    category = await prisma.documentCategory.create({
      data: {
        tenantId,
        name: categoryName
      }
    });
  }

  const template = await prisma.documentTemplate.create({
    data: {
      tenantId,
      title: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS + PROCURAÇÃO + HIPOSSUFICIÊNCIA',
      content: templateContent,
      categoryId: category.id
    }
  });

  console.log('Template created with ID:', template.id);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
