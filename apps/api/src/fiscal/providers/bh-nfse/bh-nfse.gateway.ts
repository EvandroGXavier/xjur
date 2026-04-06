import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import { SecurityService } from '../../../security/security.service';
import axios from 'axios';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class BhNfseGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  async authorizeInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        documentModel: 'NFSE',
      },
      include: {
        contact: true,
        items: true,
      },
    });

    if (!invoice) {
      throw new Error('Documento NFS-e nao encontrado.');
    }

    const config = await this.prisma.fiscalConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new Error('Configuracao fiscal nao encontrada para NFS-e.');
    }

    const mode = (process.env.BH_NFSE_GATEWAY_MODE || 'MOCK').toUpperCase();
    const series = invoice.series || config.serieNfse || 1;
    const rpsNumber = config.proximoNumeroRps || 1;
    const nfseNumber = invoice.number || String(config.proximoNumeroNfse || 1);
    const batchNumber = String(Date.now());
    const protocol = `BH-MOCK-${Date.now()}`;
    const issueDate = new Date();

    const payload = {
      provider: config.provedorNfse || 'BH',
      cityCode: config.codigoMunicipioIbge,
      rpsNumber,
      series,
      services: invoice.items.map((item) => ({
        description: item.description,
        serviceCode: item.serviceCode || item.serviceCodeMunicipal,
        amount: item.netAmount,
        issRate: item.issRate,
      })),
      issueDate: issueDate.toISOString(),
      mode,
    };

    if (mode === 'LIVE') {
      return this.authorizeLive(invoice, config, payload, issueDate);
    }

    const xmlDraft = this.buildMockXml(invoice, nfseNumber, protocol, payload);
    const xmlAuthorized = xmlDraft.replace(
      '<status>DRAFT</status>',
      '<status>AUTHORIZED</status>',
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.fiscalConfig.update({
        where: { tenantId },
        data: {
          proximoNumeroNfse: Number(nfseNumber) + 1,
          proximoNumeroRps: Number(rpsNumber) + 1,
        },
      });

      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          provider: 'BH',
          providerCityCode: config.codigoMunicipioIbge,
          series,
          number: nfseNumber,
          receiptNumber: String(rpsNumber),
          batchNumber,
          issueDate,
          xmlDraft,
          xmlAuthorized,
          requestPayload: payload,
          responsePayload: {
            mode,
            protocol,
            batchNumber,
          },
          authorizationProtocol: protocol,
          authorizationDate: issueDate,
          status: 'AUTHORIZED',
          events: {
            create: {
              type: 'AUTHORIZATION',
              status: 'AUTHORIZED',
              payload: {
                mode,
                protocol,
                batchNumber,
                rpsNumber,
              },
            },
          },
        },
      });
    });

    return updated;
  }

  private async authorizeLive(
    invoice: any,
    config: any,
    payload: any,
    issueDate: Date,
  ) {
    const baseUrl = this.resolveBaseUrl(config.environment || 'HOMOLOGATION');
    const agent = await this.buildHttpsAgent(config);
    const xml = this.extractNationalXml(invoice);

    const response = await axios.post(`${baseUrl}/nfse`, xml, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/xml',
      },
      timeout: 30000,
    });

    const parsed = this.parseXml(response.data);
    const infNfse = parsed?.NFSe?.infNFSe || parsed?.nfse?.infNFSe || null;

    if (!infNfse) {
      throw new Error('SEFIN Nacional nao retornou uma NFS-e autorizada valida.');
    }

    const protocol =
      infNfse?.nProt ||
      infNfse?.prot ||
      response.headers['x-protocolo'] ||
      null;
    const batchNumber =
      infNfse?.nLote || invoice.batchNumber || String(Date.now());
    const nfseNumber = infNfse?.nNFSe || invoice.number || null;
    const rpsNumber = infNfse?.nRps || invoice.receiptNumber || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.fiscalConfig.update({
        where: { tenantId: invoice.tenantId },
        data: {
          proximoNumeroNfse:
            Number(config.proximoNumeroNfse || nfseNumber || 1) + 1,
          proximoNumeroRps: Number(config.proximoNumeroRps || rpsNumber || 1) + 1,
        },
      });

      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          provider: 'SEFIN_NACIONAL_BH',
          providerCityCode: config.codigoMunicipioIbge,
          number: nfseNumber ? String(nfseNumber) : invoice.number,
          receiptNumber: rpsNumber ? String(rpsNumber) : invoice.receiptNumber,
          batchNumber: String(batchNumber),
          issueDate,
          xmlDraft: xml,
          xmlAuthorized: response.data,
          requestPayload: {
            ...payload,
            liveEndpoint: `${baseUrl}/nfse`,
          },
          responsePayload: {
            headers: response.headers,
          },
          authorizationProtocol: protocol,
          authorizationDate: issueDate,
          status: 'AUTHORIZED',
          events: {
            create: {
              type: 'AUTHORIZATION',
              status: 'AUTHORIZED',
              payload: {
                live: true,
                protocol,
                batchNumber,
                nfseNumber,
                rpsNumber,
              },
            },
          },
        },
      });
    });

    return updated;
  }

  private buildMockXml(
    invoice: any,
    nfseNumber: string,
    protocol: string,
    payload: any,
  ) {
    return `
<nfse>
  <number>${nfseNumber}</number>
  <protocol>${protocol}</protocol>
  <scope>${invoice.scope}</scope>
  <status>DRAFT</status>
  <payload>${JSON.stringify(payload)}</payload>
</nfse>`.trim();
  }

  private resolveBaseUrl(environment: string) {
    if (environment === 'PRODUCTION') {
      return (
        process.env.BH_NFSE_PROD_BASE_URL ||
        'https://sefin.nfse.gov.br/SefinNacional'
      );
    }

    return (
      process.env.BH_NFSE_HOM_BASE_URL ||
      'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional'
    );
  }

  private extractNationalXml(invoice: any) {
    const xml =
      invoice.xmlDraft ||
      invoice.xmlContent ||
      invoice.requestPayload?.signedXml ||
      null;

    if (!xml || (!String(xml).includes('<DPS') && !String(xml).includes('<NFSe'))) {
      throw new Error(
        'NFS-e em modo LIVE exige XML nacional DPS/NFSe completo em xmlDraft/requestPayload.signedXml.',
      );
    }

    return String(xml);
  }

  private parseXml(xml: string) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    return parser.parse(xml);
  }

  private async buildHttpsAgent(config: any) {
    if (!config.securitySecretId) {
      throw new Error(
        'Configuracao fiscal sem securitySecretId para uso do certificado A1.',
      );
    }

    const secret = await this.prisma.securitySecret.findFirst({
      where: {
        tenantId: config.tenantId,
        id: config.securitySecretId,
      },
    });

    if (!secret) {
      throw new Error('Segredo do certificado fiscal nao encontrado.');
    }

    const downloaded = await this.securityService.downloadSecretFile(
      secret.id,
      config.tenantId,
    );

    return new https.Agent({
      pfx: downloaded.buffer,
      passphrase: secret.password
        ? this.securityService.decodeSecretValue(secret.password)
        : undefined,
      rejectUnauthorized: true,
    });
  }
}
