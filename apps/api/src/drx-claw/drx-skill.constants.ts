export type DrxSkillScope = "SYSTEM" | "CUSTOM";

export type DrxSkill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  triggerKeywords: string[];
  enabled: boolean;
  scope?: DrxSkillScope;
  usageContexts?: string[];
};

export const PROCESS_PDF_SKILL_ID = "processo-eletronico-pje-eproc";

export const DEFAULT_SKILLS: DrxSkill[] = [
  {
    id: "triagem-juridica",
    name: "Triagem Juridica",
    description:
      "Qualifica pedidos iniciais e organiza contexto antes de acionar equipes.",
    instructions:
      "Identifique demanda, urgencia, documentos faltantes e proximo passo recomendado.",
    triggerKeywords: [
      "triagem",
      "novo cliente",
      "analise inicial",
      "qualificar",
    ],
    enabled: true,
    scope: "SYSTEM",
    usageContexts: ["ATENDIMENTO", "PLAYGROUND"],
  },
  {
    id: "financeiro-cobranca",
    name: "Financeiro e Cobranca",
    description:
      "Ajuda em cobrancas, lembretes de vencimento e negociacao de parcelas.",
    instructions:
      "Responda com tom objetivo, valores claros e proximo passo de cobranca.",
    triggerKeywords: [
      "boleto",
      "vencimento",
      "cobranca",
      "pagamento",
      "financeiro",
    ],
    enabled: true,
    scope: "SYSTEM",
    usageContexts: ["FINANCEIRO", "PLAYGROUND"],
  },
  {
    id: "agenda-followup",
    name: "Agenda e Follow-up",
    description: "Propoe retornos, follow-ups e organizacao de compromissos.",
    instructions:
      "Sugira agenda, retorno, prazo e resumo executivo do atendimento.",
    triggerKeywords: ["agenda", "retorno", "follow-up", "lembrete", "prazo"],
    enabled: true,
    scope: "SYSTEM",
    usageContexts: ["AGENDA", "PLAYGROUND"],
  },
  {
    id: PROCESS_PDF_SKILL_ID,
    name: "Leitor Juridico de Processos Eletronicos",
    description:
      "Analisa PDF de autos do PJe ou eproc com estrategia PDF-first, identifica capa, partes, qualificacoes, pecas, fase, prazos e pendencias sem depender do CNJ quando o proprio PDF ja e suficiente.",
    instructions:
      "Aja como um Especialista em Direito Processual Civil e Digital com estrategia de importacao orientada por tribunal. Prioridades obrigatorias: 1. DETECTE primeiro o sistema processual (PJe, eproc, Projudi ou outro). 2. Em PJe, use a primeira pagina como fonte canonica da capa TJ: CNJ, classe, orgao julgador, distribuicao, valor, assuntos, partes e lista de documentos. 3. So aprofunde leitura quando houver ganho real: busque qualificacao completa das partes prioritariamente na peticao inicial e na contestacao, sem varrer o PDF inteiro sem necessidade. 4. Nao dependa de consulta ao CNJ/DataJud quando o proprio PDF ja trouxer dados mais ricos. 5. EXTRAIA dados estruturados: CNJ, partes, procuradores, qualificacao completa, valor, prazos, fase e pendencias. 6. DETECTE urgencia e riscos: liminares, audiencias, bloqueios, prazos fatais e atos que exigem providencia. 7. RESUMA em linguagem operacional, sem inventar dados. Use a tag [Sugestao IA - Validar] para interpretacoes de prazo ou inferencias.",
    triggerKeywords: [
      "pdf do processo",
      "autos",
      "pje",
      "eproc",
      "andamentos",
      "partes",
      "procuradores",
      "prazo processual",
      "resumo do processo",
    ],
    enabled: true,
    scope: "SYSTEM",
    usageContexts: ["PROCESSO_PDF", "PLAYGROUND", "ANALISE_PROCESSUAL"],
  },
];

const DEFAULT_SKILL_BY_ID = new Map(
  DEFAULT_SKILLS.map((skill) => [skill.id, skill]),
);

function normalizeText(value: any) {
  return String(value || "").trim();
}

function normalizeKeywords(value: any, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeUsageContexts(value: any, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function buildSkillId(name: string) {
  return (
    normalizeText(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `skill-${Date.now()}`
  );
}

export function normalizeDrxSkill(input: any, fallback?: DrxSkill): DrxSkill {
  const preset = DEFAULT_SKILL_BY_ID.get(String(input?.id || fallback?.id || ""));
  const base = preset || fallback;
  const name = normalizeText(input?.name || base?.name);

  return {
    id: normalizeText(input?.id || base?.id) || buildSkillId(name),
    name: name || "Skill sem nome",
    description: normalizeText(input?.description || base?.description),
    instructions: normalizeText(input?.instructions || base?.instructions),
    triggerKeywords: normalizeKeywords(
      input?.triggerKeywords,
      base?.triggerKeywords,
    ),
    enabled:
      typeof input?.enabled === "boolean"
        ? input.enabled
        : typeof base?.enabled === "boolean"
          ? base.enabled
          : true,
    scope: base?.scope || input?.scope || "CUSTOM",
    usageContexts: normalizeUsageContexts(
      input?.usageContexts,
      base?.usageContexts,
    ),
  };
}

export function mergeDrxSkills(input: any): DrxSkill[] {
  const incoming = Array.isArray(input)
    ? input
        .map((skill) => normalizeDrxSkill(skill))
        .filter((skill) => normalizeText(skill.id))
    : [];

  const incomingById = new Map(incoming.map((skill) => [skill.id, skill]));
  const mergedDefaults = DEFAULT_SKILLS.map((skill) =>
    normalizeDrxSkill(incomingById.get(skill.id), skill),
  );

  const customSkills = incoming
    .filter((skill) => !DEFAULT_SKILL_BY_ID.has(skill.id))
    .map((skill) => ({
      ...skill,
      scope: (skill.scope === "SYSTEM" ? "SYSTEM" : "CUSTOM") as DrxSkillScope,
    }));

  return [...mergedDefaults, ...customSkills];
}
