import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ProcessIntegrationsService } from "./process-integrations.service";

export interface ProcessData {
  cnj: string;
  npu: string;
  court: string;
  courtSystem: string;
  vars: string;
  district: string;
  status: string;
  area: string;
  subject: string;
  class: string;
  distributionDate?: Date;
  judge: string;
  value: number;
  parties: Array<{ name: string; type: string; document?: string }>;
  movements: Array<{ date: Date; description: string; type: string }>;
  title?: string;
  metadata?: any;
}

@Injectable()
export class ProcessCrawlerService {
  private readonly logger = new Logger(ProcessCrawlerService.name);

  constructor(
    private readonly integrationsService: ProcessIntegrationsService,
  ) {}

  /**
   * Busca universal (CNJ, CPF, Nome)
   */
  async search(term: string, tenantId?: string): Promise<ProcessData | ProcessData[]> {
    const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, "");

    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (/^\d{15,20}$/.test(cleanTerm)) {
      return this.crawlByCnj(cleanTerm, tenantId);
    }

    const isDoc =
      /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(cleanTerm) ||
      /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(cleanTerm);

    const authorName = isDoc
      ? "Autor Simulado (Busca por CPF)"
      : term.toUpperCase();
    const authorDoc = isDoc ? term : "000.000.000-00";

    return {
      cnj: "5009999-88.2025.8.13.0024",
      npu: "5009999-88.2025.8.13.0024",
      court: "TJMG",
      courtSystem: "PJe",
      vars: "1a Vara Empresarial",
      district: "Belo Horizonte",
      status: "DISTRIBUIDO",
      area: "Civel",
      subject: "Execucao de Titulo Extrajudicial",
      class: "Execucao",
      distributionDate: new Date("2025-02-01"),
      judge: "Dr. Substituto",
      value: 12500.5,
      parties: [
        { name: authorName, type: "AUTOR", document: authorDoc },
        {
          name: "Reu Generico SA",
          type: "REU",
          document: "99.999.999/0001-99",
        },
      ],
      movements: [
        {
          date: new Date(),
          description: "Distribuicao automatica",
          type: "DISTRIBUTION",
        },
      ],
      metadata: {
        source: "MOCK_SEARCH_FALLBACK",
      },
    };
  }

  /**
   * Consulta por CNJ.
   * Usa a integracao oficial configurada quando disponivel.
   */
  async crawlByCnj(cnj: string, tenantId?: string): Promise<ProcessData> {
    const cleanCnj = cnj.replace(/\D/g, "");
    if (cleanCnj.length < 10) {
      throw new HttpException("CNJ invalido", HttpStatus.BAD_REQUEST);
    }

    if (tenantId) {
      try {
        const config = await this.integrationsService.getEffectiveConfig(
          tenantId,
        );
        if (config.enabled && config.provider === "DATAJUD" && config.datajud.enabled) {
          if (!config.datajud.apiKey) {
            throw new BadRequestException(
              "A integracao DataJud esta ativa, mas a API Key ainda nao foi informada na configuracao geral de processos.",
            );
          }

          const imported = await this.integrationsService.importByCnj(
            tenantId,
            cnj,
          );
          if (imported) {
            return imported as ProcessData;
          }
        }
      } catch (error: any) {
        if (
          error instanceof BadRequestException ||
          error instanceof HttpException
        ) {
          throw error;
        }

        this.logger.warn(
          `Falha na consulta oficial do processo. Usando fallback local. Motivo: ${error.message}`,
        );
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const isTjmg = cnj.includes(".8.13.");
    const isTrf1 = cnj.includes(".4.01.");
    const isLabor = cnj.includes(".5.03.");

    let court = "OUTRO";
    let system = "Desconhecido";

    if (isTjmg) {
      court = "TJMG";
      system = "PJe";
    }
    if (isTrf1) {
      court = "TRF1";
      system = "PJe Federal";
    }
    if (isLabor) {
      court = "TRT3";
      system = "PJe-JT";
    }

    return {
      cnj,
      npu: `${cleanCnj.substring(0, 7)}-${cleanCnj.substring(7, 9)}.${cleanCnj.substring(9, 13)}.${cleanCnj.substring(13, 14)}.${cleanCnj.substring(14, 16)}.${cleanCnj.substring(16)}`,
      court,
      courtSystem: system,
      vars: "2a Vara Civel",
      district: "Belo Horizonte",
      status: "ATIVO",
      area: "Civel",
      subject: "Indenizacao por Danos Morais",
      class: "Procedimento Comum Civel",
      distributionDate: new Date("2025-01-15"),
      judge: "Dr. Joao da Silva (Simulado)",
      value: 50000,
      parties: [
        {
          name: "Empresa X Ltda",
          type: "AUTOR",
          document: "12.345.678/0001-90",
        },
        {
          name: "Consumidor Y",
          type: "REU",
          document: "123.456.789-00",
        },
      ],
      movements: [
        {
          date: new Date(),
          description: "Conclusos para decisao",
          type: "UPDATE",
        },
        {
          date: new Date(Date.now() - 86400000 * 5),
          description: "Juntada de peticao",
          type: "PETITION",
        },
      ],
      metadata: {
        source: "MOCK_CRAWLER_FALLBACK",
      },
    };
  }
}
