import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { XMLParser } from 'fast-xml-parser';
import { StockService } from '../stock/stock.service';

@Injectable()
export class FiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async processXml(tenantId: string, xmlContent: string) {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const jsonObj = parser.parse(xmlContent);

      const nfeProc = jsonObj.nfeProc || jsonObj;
      const nfe = nfeProc.NFe;

      if (!nfe?.infNFe) {
        throw new Error(
          'O formato do XML e invalido ou nao corresponde a uma NF-e aceita.',
        );
      }

      const infNFe = nfe.infNFe;
      const numNFE = infNFe.ide.nNF;
      const accessKey = infNFe['@_Id']
        ? String(infNFe['@_Id']).replace('NFe', '')
        : null;

      return this.prisma.$transaction(async (tx) => {
        if (accessKey) {
          const existingInvoice = await tx.invoice.findFirst({
            where: { tenantId, accessKey },
          });

          if (existingInvoice) {
            throw new BadRequestException(
              `A NF-e ${numNFE} ja foi importada anteriormente.`,
            );
          }
        }

        const invConfig = await tx.inventoryConfig.findUnique({
          where: { tenantId },
        });
        const profitMargin = invConfig ? Number(invConfig.profitMargin) : 30;

        const emit = infNFe.emit;
        const cnpj = String(emit.CNPJ || '').replace(/\D/g, '');
        const razaoSocial = emit.xNome;

        let supplier = await tx.supplier.findFirst({
          where: { document: cnpj, tenantId },
        });

        if (!supplier) {
          supplier = await tx.supplier.create({
            data: {
              tenantId,
              name: razaoSocial,
              document: cnpj,
            },
          });
        }

        let contact = await tx.contact.findFirst({
          where: { document: cnpj, tenantId },
        });

        if (!contact) {
          contact = await tx.contact.create({
            data: {
              tenantId,
              name: razaoSocial,
              document: cnpj,
              category: 'Fornecedor',
              personType: 'PJ',
              pjDetails: {
                create: {
                  cnpj,
                  companyName: razaoSocial,
                },
              },
            },
          });
        }

        let items = infNFe.det;
        if (!Array.isArray(items)) {
          items = [items];
        }

        let invoiceTotal = 0;

        for (const item of items) {
          const productXml = item.prod;
          const amount = parseFloat(productXml.vProd || 0);
          const quantity = parseInt(productXml.qCom || '0', 10);
          const unitPrice = parseFloat(productXml.vUnCom || 0);
          const sku = productXml.cProd ? String(productXml.cProd) : undefined;
          const name = productXml.xProd;

          invoiceTotal += amount;

          let product = sku
            ? await tx.product.findFirst({
                where: { sku, tenantId },
              })
            : null;

          if (!product) {
            product = await tx.product.create({
              data: {
                tenantId,
                name,
                sku,
                barcode:
                  productXml.cEAN !== 'SEM GTIN'
                    ? String(productXml.cEAN)
                    : null,
                ncm: productXml.NCM ? String(productXml.NCM) : null,
                cest: productXml.CEST ? String(productXml.CEST) : null,
                type: 'PRODUCT',
                currentStock: 0,
                isActive: true,
                supplierId: contact.id,
                costPrice: unitPrice,
                sellPrice: unitPrice * (1 + profitMargin / 100),
                unit: productXml.uCom ? productXml.uCom.substring(0, 2) : 'UN',
                minStock: 0,
              },
            });
          }

          await this.stockService.applyMovement(tx, {
            tenantId,
            productId: product.id,
            type: 'IN',
            quantity,
            unitPrice,
            totalPrice: amount,
            reason: `Entrada via importacao XML Fiscal (NF-e ${numNFE})`,
            productUpdates: {
              costPrice: unitPrice,
              sellPrice: unitPrice * (1 + profitMargin / 100),
            },
          });
        }

        let dueDate = new Date();
        const cobr = infNFe.cobr;
        if (cobr?.dup) {
          let dup = cobr.dup;
          if (Array.isArray(dup)) {
            dup = dup[0];
          }
          if (dup.dVenc) {
            dueDate = new Date(dup.dVenc);
          }
        }

        const vNF = infNFe.total?.ICMSTot?.vNF;
        if (vNF) {
          invoiceTotal = parseFloat(vNF);
        }

        const financialRecord = await tx.financialRecord.create({
          data: {
            tenantId,
            description: `NF-e ${numNFE} - ${razaoSocial}`,
            amount: invoiceTotal,
            dueDate,
            status: 'PENDING',
            type: 'EXPENSE',
            category: 'COMPRAS_XML',
          },
        });

        await tx.invoice.create({
          data: {
            tenantId,
            contactId: contact.id,
            number: String(numNFE),
            accessKey,
            xmlContent,
            type: 'INPUT',
            status: 'AUTHORIZED',
            financialId: financialRecord.id,
          },
        });

        return {
          success: true,
          message: `XML da NF-e ${numNFE} importado com sucesso! Fornecedor e ${items.length} produtos atualizados no estoque.`,
        };
      });
    } catch (error: any) {
      console.error('[FiscalService] Erro ao processar XML:', error);
      throw new BadRequestException('Falha no processamento: ' + error.message);
    }
  }
}
