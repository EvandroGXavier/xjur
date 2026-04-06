import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

@Injectable()
export class BhNfseGatewayService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (mode !== 'MOCK') {
      throw new Error(
        'Gateway NFS-e BH em modo LIVE ainda depende do adaptador SOAP/Portal homologado do provedor.',
      );
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
}
