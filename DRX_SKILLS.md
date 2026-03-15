# DRX Skills

Este documento identifica as skills oficiais do DrX no Xjur, seus objetivos e os pontos principais de uso no sistema.

## Regras de governanca

- Skills `SYSTEM` fazem parte do produto e devem ser identificadas no cadastro.
- Skills `CUSTOM` pertencem a cada empresa e podem ser criadas ou removidas livremente.
- Correcoes de texto, gatilhos e instrucoes devem ser feitas em `Configuracoes > Skills`.
- Quando uma skill do sistema nao for desejada em uma empresa, prefira `pausar` em vez de excluir.

## Skills do sistema

### `triagem-juridica`

- Nome: `Triagem Juridica`
- Missao: qualificar pedidos iniciais, apontar urgencia, lacunas documentais e proximo passo.
- Uso principal: atendimento inicial e testes no playground do DrX-Claw.

### `financeiro-cobranca`

- Nome: `Financeiro e Cobranca`
- Missao: apoiar comunicacoes de cobranca, vencimento e negociacao.
- Uso principal: fluxos financeiros e testes no playground do DrX-Claw.

### `agenda-followup`

- Nome: `Agenda e Follow-up`
- Missao: sugerir retornos, lembretes, follow-ups e organizacao operacional.
- Uso principal: agenda, relacionamento e playground do DrX-Claw.

### `processo-eletronico-pje-eproc`

- Nome: `Leitor Juridico de Processos Eletronicos`
- Missao: ler PDF de autos do PJe/eproc, separar extracao de inferencia e organizar processo, polos, partes, procuradores, pecas, prazos e pendencias.
- Uso principal:
  - `Processos > Principal > PDF Integral do Processo`
  - `Configuracoes > Skills`
  - `DrX-Claw > Playground`, quando acionada por gatilho ou selecao de fluxo

## Ponto de integracao processual

No fluxo `PDF Integral do Processo`, o sistema:

1. extrai e estrutura o PDF;
2. cadastra ou atualiza o processo;
3. sincroniza partes, procuradores e andamentos;
4. aciona a skill `processo-eletronico-pje-eproc`;
5. pede ao DrX-Claw o resumo operacional final.

## Manutencao

- Aba dedicada: `Configuracoes > Skills`
- Painel tecnico geral: `Configuracoes > DrX-Claw`
- Arquivo de referencia deste catalogo: `DRX_SKILLS.md`
