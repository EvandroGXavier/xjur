import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SecurityService } from '../security/security.service';
import axios from 'axios';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class NfeGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  async authorizeInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        documentModel: 'NFE',
      },
      include: {
        contact: true,
        items: true,
      },
    });

    if (!invoice) {
      throw new Error('Documento NF-e nao encontrado.');
    }

    const config = await this.prisma.fiscalConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new Error('Configuracao fiscal nao encontrada para NF-e.');
    }

    const series = invoice.series || config.serieNfe || 1;
    const number = invoice.number || String(config.proximoNumeroNfe || 1);
    const issueDate = new Date();
    const mode = (process.env.NFE_GATEWAY_MODE || 'MOCK').toUpperCase();

    const draftPayload = {
      emitente: config.cnpjEmitente,
      destinatario: invoice.contact?.document || null,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        cfop: item.cfop,
        ncm: item.ncm,
      })),
      issueDate: issueDate.toISOString(),
      mode,
    };

    if (mode === 'LIVE') {
      return this.authorizeLive(invoice, config, draftPayload, issueDate);
    }

    const accessKey = `${tenantId.replace(/-/g, '').slice(0, 8)}${String(series).padStart(3, '0')}${String(number).padStart(9, '0')}55`;
    const authorizationProtocol = `MOCK-NFE-${Date.now()}`;
    const xmlDraft = this.buildMockXml(invoice, number, accessKey, draftPayload);
    const xmlAuthorized = xmlDraft.replace(
      '<status>DRAFT</status>',
      '<status>AUTHORIZED</status>',
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextNumber = Number(number) + 1;

      await tx.fiscalConfig.update({
        where: { tenantId },
        data: {
          proximoNumeroNfe: nextNumber,
        },
      });

      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          scope: invoice.scope,
          series,
          number,
          accessKey,
          environment: invoice.environment || config.environment,
          provider: 'SEFAZ',
          providerCityCode: config.webserviceUf,
          issueDate,
          xmlDraft,
          xmlAuthorized,
          requestPayload: draftPayload,
          responsePayload: {
            mode,
            authorizationProtocol,
            averageResponseMs: 250,
          },
          authorizationProtocol,
          authorizationDate: issueDate,
          status: 'AUTHORIZED',
          events: {
            create: {
              type: 'AUTHORIZATION',
              status: 'AUTHORIZED',
              payload: {
                mode,
                accessKey,
                authorizationProtocol,
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
    draftPayload: any,
    issueDate: Date,
  ) {
    const signedXml = this.extractSignedXml(invoice);
    const endpointConfig = this.resolveEndpointConfig(
      config.environment || 'HOMOLOGATION',
      config.webserviceUf || process.env.NFE_DEFAULT_UF || 'MG',
    );
    const agent = await this.buildHttpsAgent(config);
    const soapEnvelope = this.wrapSoapEnvelope(
      endpointConfig.authorizationNamespace,
      signedXml,
    );

    const authResponse = await axios.post(
      endpointConfig.authorizationUrl,
      soapEnvelope,
      {
        httpsAgent: agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
        },
        timeout: 30000,
      },
    );

    const parsedAuthorization = this.parseXml(authResponse.data);
    const receiptNumber =
      parsedAuthorization?.soap12Envelope?.soap12Body?.nfeResultMsg?.retEnviNFe
        ?.infRec?.nRec ||
      parsedAuthorization?.Envelope?.Body?.nfeResultMsg?.retEnviNFe?.infRec?.nRec;

    const statusCode =
      parsedAuthorization?.soap12Envelope?.soap12Body?.nfeResultMsg?.retEnviNFe
        ?.cStat ||
      parsedAuthorization?.Envelope?.Body?.nfeResultMsg?.retEnviNFe?.cStat;

    if (!receiptNumber && statusCode !== '104') {
      throw new Error(
        'SEFAZ nao retornou numero de recibo para consulta da NF-e.',
      );
    }

    let protocolResponse = parsedAuthorization;
    if (receiptNumber) {
      const retEnvelope = this.wrapSoapEnvelope(
        endpointConfig.returnNamespace,
        `<consReciNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${this.resolveTpAmb(
          config.environment,
        )}</tpAmb><nRec>${receiptNumber}</nRec></consReciNFe>`,
      );

      const retResponse = await axios.post(
        endpointConfig.returnUrl,
        retEnvelope,
        {
          httpsAgent: agent,
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
          },
          timeout: 30000,
        },
      );

      protocolResponse = this.parseXml(retResponse.data);
    }

    const prot =
      protocolResponse?.soap12Envelope?.soap12Body?.nfeResultMsg?.retConsReciNFe
        ?.protNFe?.infProt ||
      protocolResponse?.Envelope?.Body?.nfeResultMsg?.retConsReciNFe?.protNFe
        ?.infProt;
    const finalStatus =
      prot?.cStat ||
      protocolResponse?.soap12Envelope?.soap12Body?.nfeResultMsg?.retEnviNFe
        ?.cStat ||
      protocolResponse?.Envelope?.Body?.nfeResultMsg?.retEnviNFe?.cStat;

    if (finalStatus !== '100') {
      throw new Error(
        `SEFAZ retornou status ${finalStatus || 'desconhecido'} para autorizacao NF-e.`,
      );
    }

    const accessKey = prot?.chNFe || invoice.accessKey || null;
    const authorizationProtocol = prot?.nProt || null;
    const xmlAuthorized = this.attachProtocol(signedXml, prot);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.fiscalConfig.update({
        where: { tenantId: invoice.tenantId },
        data: {
          proximoNumeroNfe: Number(invoice.number || config.proximoNumeroNfe || 1) + 1,
        },
      });

      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          accessKey,
          issueDate,
          xmlDraft: signedXml,
          xmlAuthorized,
          requestPayload: {
            ...draftPayload,
            liveEndpoint: endpointConfig.authorizationUrl,
          },
          responsePayload: protocolResponse,
          authorizationProtocol,
          authorizationDate: issueDate,
          receiptNumber,
          status: 'AUTHORIZED',
          events: {
            create: {
              type: 'AUTHORIZATION',
              status: 'AUTHORIZED',
              payload: {
                live: true,
                accessKey,
                receiptNumber,
                authorizationProtocol,
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
    number: string,
    accessKey: string,
    payload: any,
  ) {
    return `
<nfe>
  <number>${number}</number>
  <accessKey>${accessKey}</accessKey>
  <scope>${invoice.scope}</scope>
  <status>DRAFT</status>
  <payload>${JSON.stringify(payload)}</payload>
</nfe>`.trim();
  }

  private extractSignedXml(invoice: any) {
    const rawXml =
      invoice.xmlDraft ||
      invoice.xmlContent ||
      invoice.requestPayload?.signedXml ||
      null;

    if (!rawXml || !String(rawXml).includes('<enviNFe')) {
      throw new Error(
        'NF-e em modo LIVE exige um XML assinado completo em xmlDraft/requestPayload.signedXml.',
      );
    }

    return String(rawXml);
  }

  private resolveEndpointConfig(environment: string, uf: string) {
    const envKey = environment === 'PRODUCTION' ? 'PROD' : 'HOM';
    const normalizedUf = String(uf || 'MG').toUpperCase();

    const authorizationUrl =
      process.env[`NFE_${normalizedUf}_${envKey}_AUTH_URL`] ||
      process.env[`NFE_${envKey}_AUTH_URL`];
    const returnUrl =
      process.env[`NFE_${normalizedUf}_${envKey}_RET_URL`] ||
      process.env[`NFE_${envKey}_RET_URL`];

    if (!authorizationUrl || !returnUrl) {
      throw new Error(
        `URLs de NF-e nao configuradas para ${normalizedUf}/${envKey}.`,
      );
    }

    return {
      authorizationUrl,
      returnUrl,
      authorizationNamespace:
        'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
      returnNamespace:
        'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4',
    };
  }

  private resolveTpAmb(environment: string) {
    return environment === 'PRODUCTION' ? '1' : '2';
  }

  private parseXml(xml: string) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    return parser.parse(xml);
  }

  private wrapSoapEnvelope(namespace: string, xml: string) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="${namespace}">
      <![CDATA[${xml}]]>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
  }

  private attachProtocol(xml: string, prot: any) {
    if (!prot) return xml;
    return `${xml}\n<!-- protocolo:${prot.nProt || ''} chave:${prot.chNFe || ''} -->`;
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
