import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NfeGatewayService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (mode !== 'MOCK') {
      throw new Error(
        'Gateway NF-e em modo LIVE ainda depende da integracao SEFAZ e do certificado A1 homologado.',
      );
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
}
