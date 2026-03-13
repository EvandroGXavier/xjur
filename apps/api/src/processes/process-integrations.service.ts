import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import axios from "axios";
import { PrismaService } from "../prisma.service";

type SupportedTribunal = {
  code: string;
  label: string;
  alias: string;
  system: string;
  recommended?: boolean;
};

type ProcessIntegrationConfig = {
  enabled: boolean;
  provider: "DATAJUD" | "MANUAL";
  autoImportStrategy: "REVIEW_BEFORE_SAVE" | "AUTO_SAVE";
  syncMode: "MANUAL" | "ON_DEMAND";
  notes: string;
  datajud: {
    enabled: boolean;
    apiKey: string;
    tribunalCode: string;
    tribunalAlias: string;
    tribunalLabel: string;
    baseUrl: string;
    timeoutMs: number;
    maxMovements: number;
  };
  eprocMg: {
    requestStatus:
      | "NAO_SOLICITADO"
      | "EM_ANALISE"
      | "HOMOLOGACAO"
      | "LIBERADO";
    institutionName: string;
    accessLogin: string;
    accessPassword: string;
    endpointUrl: string;
    notes: string;
  };
};

const SUPPORTED_TRIBUNALS: SupportedTribunal[] = [
  {
    code: "TJMG",
    label: "Tribunal de Justica de Minas Gerais",
    alias: "api_publica_tjmg",
    system: "TJMG / Consulta publica + Eproc/MNI (quando houver autorizacao formal)",
    recommended: true,
  },
  {
    code: "TRF6",
    label: "Tribunal Regional Federal da 6a Regiao",
    alias: "api_publica_trf6",
    system: "TRF6",
  },
  {
    code: "TRT3",
    label: "Tribunal Regional do Trabalho da 3a Regiao",
    alias: "api_publica_trt3",
    system: "TRT3 / PJe-JT",
  },
  {
    code: "TJMMG",
    label: "Tribunal de Justica Militar de Minas Gerais",
    alias: "api_publica_tjmmg",
    system: "TJMMG",
  },
  {
    code: "TJRJ",
    label: "Tribunal de Justica do Rio de Janeiro",
    alias: "api_publica_tjrj",
    system: "TJRJ",
  },
  {
    code: "TRF1",
    label: "Tribunal Regional Federal da 1a Regiao",
    alias: "api_publica_trf1",
    system: "TRF1",
  },
];

const DEFAULT_TRIBUNAL =
  SUPPORTED_TRIBUNALS.find((item) => item.code === "TJMG") ??
  SUPPORTED_TRIBUNALS[0];

const DEFAULT_CONFIG: ProcessIntegrationConfig = {
  enabled: false,
  provider: "DATAJUD",
  autoImportStrategy: "REVIEW_BEFORE_SAVE",
  syncMode: "ON_DEMAND",
  notes: "",
  datajud: {
    enabled: true,
    apiKey: "",
    tribunalCode: DEFAULT_TRIBUNAL.code,
    tribunalAlias: DEFAULT_TRIBUNAL.alias,
    tribunalLabel: DEFAULT_TRIBUNAL.label,
    baseUrl: "https://api-publica.datajud.cnj.jus.br",
    timeoutMs: 15000,
    maxMovements: 12,
  },
  eprocMg: {
    requestStatus: "NAO_SOLICITADO",
    institutionName: "",
    accessLogin: "",
    accessPassword: "",
    endpointUrl: "",
    notes: "",
  },
};

@Injectable()
export class ProcessIntegrationsService {
  private readonly logger = new Logger(ProcessIntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getConnection(tenantId: string) {
    return this.prisma.connection.findFirst({
      where: {
        tenantId,
        type: "PROCESS_INTEGRATION",
      },
      orderBy: { createdAt: "asc" },
    });
  }

  private getTribunalByCode(code?: string | null) {
    const normalized = (code || "").trim().toUpperCase();
    return (
      SUPPORTED_TRIBUNALS.find((item) => item.code === normalized) ??
      DEFAULT_TRIBUNAL
    );
  }

  private getTribunalByAlias(alias?: string | null) {
    const normalized = (alias || "").trim().toLowerCase();
    return (
      SUPPORTED_TRIBUNALS.find((item) => item.alias === normalized) ??
      DEFAULT_TRIBUNAL
    );
  }

  private sanitizePositiveNumber(
    value: any,
    fallback: number,
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  }

  private normalizeApiKey(value: any) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw
      .replace(/^Authorization\s*:\s*/i, "")
      .replace(/^APIKey\s+/i, "")
      .trim();
  }

  private mergeConfig(input: any): ProcessIntegrationConfig {
    const raw = input && typeof input === "object" ? input : {};
    const tribunal =
      this.getTribunalByCode(raw?.datajud?.tribunalCode) ||
      this.getTribunalByAlias(raw?.datajud?.tribunalAlias);

    return {
      ...DEFAULT_CONFIG,
      ...raw,
      enabled:
        typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.enabled,
      provider:
        raw.provider === "MANUAL" ? "MANUAL" : DEFAULT_CONFIG.provider,
      autoImportStrategy:
        raw.autoImportStrategy === "AUTO_SAVE"
          ? "AUTO_SAVE"
          : DEFAULT_CONFIG.autoImportStrategy,
      syncMode:
        raw.syncMode === "MANUAL" ? "MANUAL" : DEFAULT_CONFIG.syncMode,
      notes: String(raw.notes || "").trim(),
      datajud: {
        ...DEFAULT_CONFIG.datajud,
        ...(raw.datajud || {}),
        enabled:
          typeof raw?.datajud?.enabled === "boolean"
            ? raw.datajud.enabled
            : DEFAULT_CONFIG.datajud.enabled,
        apiKey: this.normalizeApiKey(raw?.datajud?.apiKey),
        tribunalCode: tribunal.code,
        tribunalAlias: tribunal.alias,
        tribunalLabel: tribunal.label,
        baseUrl:
          String(raw?.datajud?.baseUrl || DEFAULT_CONFIG.datajud.baseUrl).trim() ||
          DEFAULT_CONFIG.datajud.baseUrl,
        timeoutMs: this.sanitizePositiveNumber(
          raw?.datajud?.timeoutMs,
          DEFAULT_CONFIG.datajud.timeoutMs,
          3000,
          60000,
        ),
        maxMovements: this.sanitizePositiveNumber(
          raw?.datajud?.maxMovements,
          DEFAULT_CONFIG.datajud.maxMovements,
          3,
          50,
        ),
      },
      eprocMg: {
        ...DEFAULT_CONFIG.eprocMg,
        ...(raw.eprocMg || {}),
        requestStatus: [
          "NAO_SOLICITADO",
          "EM_ANALISE",
          "HOMOLOGACAO",
          "LIBERADO",
        ].includes(raw?.eprocMg?.requestStatus)
          ? raw.eprocMg.requestStatus
          : DEFAULT_CONFIG.eprocMg.requestStatus,
        institutionName: String(raw?.eprocMg?.institutionName || "").trim(),
        accessLogin: String(raw?.eprocMg?.accessLogin || "").trim(),
        accessPassword: String(raw?.eprocMg?.accessPassword || "").trim(),
        endpointUrl: String(raw?.eprocMg?.endpointUrl || "").trim(),
        notes: String(raw?.eprocMg?.notes || "").trim(),
      },
    };
  }

  private buildEnvelope(config: ProcessIntegrationConfig) {
    return {
      config,
      supportedTribunals: SUPPORTED_TRIBUNALS,
      providerOptions: [
        {
          value: "DATAJUD",
          label: "DataJud / CNJ",
          description:
            "Consulta oficial de metadados publicos por numero CNJ.",
        },
        {
          value: "MANUAL",
          label: "Manual / Sem integracao oficial",
          description:
            "Mantem o modulo pronto para cadastro manual ou uso assistido.",
        },
      ],
      officialDocs: [
        {
          label: "CNJ - API Publica DataJud / Acesso",
          url: "https://datajud-wiki.cnj.jus.br/api-publica/acesso/",
        },
        {
          label: "CNJ - API Publica DataJud / Endpoints",
          url: "https://datajud-wiki.cnj.jus.br/api-publica/endpoints/",
        },
        {
          label: "CNJ - Exemplo oficial de busca por numero do processo",
          url: "https://datajud-wiki.cnj.jus.br/api-publica/exemplos/exemplo1/",
        },
        {
          label: "TJMG - Portal eproc",
          url: "https://www.tjmg.jus.br/portal-tjmg/servicos/eproc/",
        },
      ],
      readiness: {
        datajudReady:
          !!config.enabled &&
          config.provider === "DATAJUD" &&
          config.datajud.enabled &&
          !!config.datajud.apiKey,
        eprocMgReady: config.eprocMg.requestStatus === "LIBERADO",
      },
    };
  }

  async getIntegrationConfig(tenantId: string) {
    const existing = await this.getConnection(tenantId);
    return this.buildEnvelope(this.mergeConfig(existing?.config));
  }

  async saveIntegrationConfig(tenantId: string, input: any) {
    const config = this.mergeConfig(input);
    const existing = await this.getConnection(tenantId);

    if (!existing) {
      await this.prisma.connection.create({
        data: {
          tenantId,
          name: "Configuracao Geral de Processos",
          type: "PROCESS_INTEGRATION",
          status: config.enabled ? "CONNECTED" : "DISCONNECTED",
          config,
        },
      });
    } else {
      await this.prisma.connection.update({
        where: { id: existing.id },
        data: {
          name: "Configuracao Geral de Processos",
          status: config.enabled ? "CONNECTED" : "DISCONNECTED",
          config,
        },
      });
    }

    return this.buildEnvelope(config);
  }

  async getEffectiveConfig(tenantId: string) {
    const existing = await this.getConnection(tenantId);
    return this.mergeConfig(existing?.config);
  }

  private normalizeCnj(cnj: string) {
    return String(cnj || "").replace(/\D/g, "");
  }

  private ensureDataJudReady(config: ProcessIntegrationConfig) {
    if (!config.enabled) {
      throw new BadRequestException(
        "A integracao processual esta desativada. Ative-a antes de testar.",
      );
    }

    if (config.provider !== "DATAJUD" || !config.datajud.enabled) {
      throw new BadRequestException(
        "O provider oficial atual precisa estar configurado como DataJud.",
      );
    }

    if (!config.datajud.apiKey) {
      throw new BadRequestException(
        "Informe a API Key publica vigente do DataJud para usar a integracao oficial.",
      );
    }
  }

  private getDataJudEndpoint(config: ProcessIntegrationConfig) {
    return `${config.datajud.baseUrl.replace(/\/$/, "")}/${config.datajud.tribunalAlias}/_search`;
  }

  private async runDataJudQuery(
    config: ProcessIntegrationConfig,
    payload: Record<string, any>,
  ) {
    const endpoint = this.getDataJudEndpoint(config);

    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `APIKey ${config.datajud.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: config.datajud.timeoutMs,
    });

    return {
      endpoint,
      data: response.data,
      status: response.status,
    };
  }

  private extractSourcePayload(hit: any) {
    if (!hit || typeof hit !== "object") return {};
    return hit._source && typeof hit._source === "object" ? hit._source : hit;
  }

  private summarizeMovements(source: any, maxMovements: number) {
    const movements = Array.isArray(source?.movimentos) ? source.movimentos : [];

    return movements
      .map((movement: any) => ({
        date: movement?.dataHora ? new Date(movement.dataHora) : new Date(),
        description: String(movement?.nome || movement?.descricao || "").trim(),
        type: String(movement?.codigo || movement?.tipo || "MOVIMENTO"),
      }))
      .filter((movement) => movement.description)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, maxMovements);
  }

  private parseCompactDate(value: any) {
    const raw = String(value || "").trim();
    if (!raw) return undefined;

    if (/^\d{14}$/.test(raw)) {
      const parsed = new Date(
        `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}`,
      );
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    if (/^\d{8}$/.test(raw)) {
      const parsed = new Date(
        `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      );
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private normalizeText(value?: string | null) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  private extractPartyName(item: any) {
    return String(
      item?.nome ||
        item?.nomeParte ||
        item?.nomePessoa ||
        item?.parte ||
        item?.participantName ||
        item?.pessoa?.nome ||
        item?.pessoa?.nomeCompleto ||
        "",
    ).trim();
  }

  private extractPartyDocument(item: any) {
    const raw = String(
      item?.documento ||
        item?.numeroDocumento ||
        item?.cpfCnpj ||
        item?.document ||
        item?.pessoa?.numeroDocumento ||
        item?.pessoa?.cpfCnpj ||
        "",
    ).trim();

    return raw ? raw.replace(/\D/g, "") : undefined;
  }

  private extractPartyType(item: any, fallbackType: string) {
    const explicitType = String(
      item?.tipoParte ||
        item?.tipo ||
        item?.papel ||
        item?.polo ||
        item?.qualidadeParte ||
        item?.descricaoTipoParte ||
        item?.representacao ||
        fallbackType,
    ).trim();

    const normalized = this.normalizeText(explicitType);

    if (
      ["AUTOR", "AUTORA", "REQUERENTE", "EXEQUENTE", "IMPETRANTE", "RECLAMANTE"].some(
        term => normalized.includes(term),
      )
    ) {
      return "AUTOR";
    }

    if (
      ["REU", "REQUERIDO", "REQUERIDA", "EXECUTADO", "RECLAMADO", "RECLAMADA"].some(
        term => normalized.includes(term),
      )
    ) {
      return "REU";
    }

    if (
      ["ADVOGADO", "ADVOGADA", "PROCURADOR", "PROCURADORA", "DEFENSOR"].some(
        term => normalized.includes(term),
      )
    ) {
      return normalized.includes("CONTRAR") ? "ADVOGADO CONTRARIO" : "ADVOGADO";
    }

    if (["JUIZ", "MAGISTRADO", "RELATOR"].some(term => normalized.includes(term))) {
      return "MAGISTRADO";
    }

    if (normalized.includes("PERITO")) return "PERITO";
    if (normalized.includes("TESTEMUNHA")) return "TESTEMUNHA";

    return fallbackType;
  }

  private appendParties(target: Array<{ name: string; type: string; document?: string }>, items: any, fallbackType: string) {
    if (!Array.isArray(items)) return;

    for (const item of items) {
      const name = this.extractPartyName(item);
      if (!name) continue;

      target.push({
        name,
        type: this.extractPartyType(item, fallbackType),
        document: this.extractPartyDocument(item),
      });
    }
  }

  private extractPartiesFromSource(source: any) {
    const collected: Array<{ name: string; type: string; document?: string }> = [];

    this.appendParties(collected, source?.poloAtivo, "AUTOR");
    this.appendParties(collected, source?.poloPassivo, "REU");
    this.appendParties(collected, source?.partes, "TERCEIRO");
    this.appendParties(collected, source?.partesProcessuais, "TERCEIRO");
    this.appendParties(collected, source?.participantes, "TERCEIRO");
    this.appendParties(collected, source?.advogados, "ADVOGADO");
    this.appendParties(collected, source?.representantes, "ADVOGADO");

    const uniqueMap = new Map<string, { name: string; type: string; document?: string }>();

    for (const party of collected) {
      const normalizedName = this.normalizeText(party.name);
      if (!normalizedName) continue;

      const key = `${normalizedName}|${party.type}|${party.document || ""}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          name: party.name,
          type: party.type,
          document: party.document,
        });
      }
    }

    return Array.from(uniqueMap.values());
  }

  private mapDataJudHit(hit: any, config: ProcessIntegrationConfig) {
    const source = this.extractSourcePayload(hit);
    const assuntos = Array.isArray(source.assuntos)
      ? source.assuntos
          .map((item: any) => String(item?.nome || "").trim())
          .filter(Boolean)
      : [];
    const movements = this.summarizeMovements(
      source,
      config.datajud.maxMovements,
    );
    const area =
      assuntos.find((item) => item.length > 2) ||
      String(source?.classe?.nome || "Judicial");
    const status =
      String(
        source?.datamart?.situacao_atual ||
          movements[0]?.description ||
          "EM ACOMPANHAMENTO",
      ).trim() || "EM ACOMPANHAMENTO";

    const valueCandidates = [
      source?.valorAcao,
      source?.valorCausa,
      source?.valorProcesso,
    ];
    const numericValue = valueCandidates
      .map((item) => Number(item))
      .find((item) => Number.isFinite(item) && item > 0);

    const systemName = String(source?.sistema?.nome || "").trim();

    return {
      cnj: String(source?.numeroProcesso || "").trim(),
      npu: String(source?.numeroProcesso || "").trim(),
      title:
        String(source?.classe?.nome || "").trim() ||
        `Processo ${String(source?.numeroProcesso || "").trim()}`,
      court: String(source?.tribunal || config.datajud.tribunalCode).trim(),
      courtSystem:
        !systemName || systemName.toLowerCase() === "inválido"
          ? `DataJud / ${config.datajud.tribunalCode}`
          : systemName,
      vars: String(source?.orgaoJulgador?.nome || "").trim(),
      district: String(source?.orgaoJulgador?.nome || "").trim(),
      status,
      area,
      subject: assuntos.join(" | "),
      class: String(source?.classe?.nome || "").trim(),
      distributionDate: this.parseCompactDate(source?.dataAjuizamento),
      judge: "Nao informado via DataJud",
      value: numericValue || 0,
      parties: this.extractPartiesFromSource(source),
      movements,
      metadata: {
        source: "DATAJUD",
        tribunalAlias: config.datajud.tribunalAlias,
        hitId: hit?._id || source?.id || null,
        nivelSigilo: source?.nivelSigilo ?? null,
        importedAt: new Date().toISOString(),
        raw: source,
      },
    };
  }

  async testIntegration(tenantId: string, body?: any) {
    const savedConfig = await this.getEffectiveConfig(tenantId);
    const candidateConfig =
      body?.config && typeof body.config === "object"
        ? this.mergeConfig(body.config)
        : savedConfig;

    if (candidateConfig.provider === "MANUAL") {
      return {
        success: true,
        provider: "MANUAL",
        testedAt: new Date().toISOString(),
        message:
          "Modo manual ativo. Nenhuma consulta externa foi executada.",
      };
    }

    this.ensureDataJudReady(candidateConfig);

    const normalizedCnj = this.normalizeCnj(body?.cnj || "");
    const payload = normalizedCnj
      ? {
          size: 1,
          query: {
            match: {
              numeroProcesso: normalizedCnj,
            },
          },
        }
      : {
          size: 1,
          sort: [{ dataHoraUltimaAtualizacao: "desc" }],
          query: { match_all: {} },
        };

    try {
      const response = await this.runDataJudQuery(candidateConfig, payload);
      const hits = response.data?.hits?.hits || [];
      const sample = hits[0]
        ? this.mapDataJudHit(hits[0], candidateConfig)
        : null;

      return {
        success: true,
        provider: "DATAJUD",
        endpoint: response.endpoint,
        testedAt: new Date().toISOString(),
        totalHits: response.data?.hits?.total?.value ?? hits.length ?? 0,
        message: normalizedCnj
          ? hits.length > 0
            ? "Consulta por CNJ executada com sucesso."
            : "Conexao valida, mas nenhum processo foi encontrado para o CNJ informado."
          : "Conexao com o DataJud validada com sucesso.",
        sample,
      };
    } catch (error: any) {
      this.logger.error(
        `Falha no teste da integracao processual: ${error.message}`,
      );

      return {
        success: false,
        provider: candidateConfig.provider,
        endpoint: this.getDataJudEndpoint(candidateConfig),
        testedAt: new Date().toISOString(),
        message:
          error?.response?.data?.message ||
          error?.response?.statusText ||
          error.message,
        details: error?.response?.data || null,
      };
    }
  }

  async importByCnj(tenantId: string, cnj: string) {
    const config = await this.getEffectiveConfig(tenantId);
    const normalizedCnj = this.normalizeCnj(cnj);

    if (normalizedCnj.length < 20) {
      throw new BadRequestException("Informe um numero CNJ valido.");
    }

    if (!config.enabled || config.provider !== "DATAJUD" || !config.datajud.enabled) {
      return null;
    }

    this.ensureDataJudReady(config);

    const response = await this.runDataJudQuery(config, {
      size: 1,
      query: {
        match: {
          numeroProcesso: normalizedCnj,
        },
      },
    });

    const hit = response.data?.hits?.hits?.[0];
    if (!hit) {
      throw new NotFoundException(
        "O processo informado nao foi encontrado no DataJud para o tribunal configurado.",
      );
    }

    return this.mapDataJudHit(hit, config);
  }
}
