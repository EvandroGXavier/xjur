import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class FiscalService {
  constructor(private readonly prisma: PrismaService) {}

  async processXml(tenantId: string, xmlContent: string) {
    try {
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const jsonObj = parser.parse(xmlContent);

      // Extract NFe data
      const nfeProc = jsonObj.nfeProc || jsonObj;
      const nfe = nfeProc.NFe;
      
      if (!nfe || !nfe.infNFe) {
        throw new Error('O formato do XML é inválido ou não corresponde a uma NF-e aceita.');
      }

      const infNFe = nfe.infNFe;
      const numNFE = infNFe.ide.nNF;

      // Pegar configuração de estoque
      let invConfig = await this.prisma.inventoryConfig.findUnique({
        where: { tenantId }
      });
      const profitMargin = invConfig ? Number(invConfig.profitMargin) : 30; // 30% default

      // 1. Process Supplier
      const emit = infNFe.emit;
      const cnpj = emit.CNPJ;
      const razaoSocial = emit.xNome;

      let supplier = await this.prisma.supplier.findFirst({
        where: { document: cnpj, tenantId }
      });

      if (!supplier) {
        supplier = await this.prisma.supplier.create({
          data: {
            tenantId,
            name: razaoSocial,
            document: cnpj,
          }
        });
      }

      // 1b. Process Contact for Invoice
      let contact = await this.prisma.contact.findFirst({
        where: { document: cnpj, tenantId }
      });

      if (!contact) {
        contact = await this.prisma.contact.create({
          data: {
            tenantId,
            name: razaoSocial,
            document: cnpj,
            category: 'Fornecedor',
            personType: 'PJ',
            pjDetails: {
              create: {
                cnpj: cnpj,
                companyName: razaoSocial,
              }
            }
          }
        });
      }

      // 2. Process Products & Update Stock
      let det = infNFe.det;
      if (!Array.isArray(det)) {
        det = [det];
      }

      let invoiceTotal = 0;

      for (const item of det) {
        const prod = item.prod;
        const amount = parseFloat(prod.vProd || 0);
        invoiceTotal += amount;
        
        const quantity = parseFloat(prod.qCom || 0);
        const sku = prod.cProd ? String(prod.cProd) : undefined;
        const name = prod.xProd;

        let product = null;
        
        // Find product by SKU and Tenant
        if (sku) {
            product = await this.prisma.product.findFirst({
              where: { sku, tenantId }
            });
        }

        if (!product) {
          product = await this.prisma.product.create({
            data: {
              tenantId,
              name,
              sku,
              barcode: prod.cEAN !== 'SEM GTIN' ? String(prod.cEAN) : null,
              ncm: prod.NCM ? String(prod.NCM) : null,
              cest: prod.CEST ? String(prod.CEST) : null,
              type: 'PRODUCT',
              currentStock: quantity,
              isActive: true,
              supplierId: supplier.id,
              costPrice: parseFloat(prod.vUnCom || 0),
              sellPrice: parseFloat(prod.vUnCom || 0) * (1 + profitMargin / 100),
              unit: prod.uCom ? prod.uCom.substring(0, 2) : 'UN',
              minStock: 0,
            }
          });
        } else {
          product = await this.prisma.product.update({
            where: { id: product.id },
            data: {
              currentStock: product.currentStock + quantity,
              costPrice: parseFloat(prod.vUnCom || 0),
              sellPrice: parseFloat(prod.vUnCom || 0) * (1 + profitMargin / 100),
            }
          });
        }

        // Add movement for tracking
        await this.prisma.inventoryMovement.create({
          data: {
            tenantId,
            productId: product.id,
            type: 'IN',
            quantity: quantity,
            unitPrice: parseFloat(prod.vUnCom || 0),
            totalPrice: amount,
            reason: `Entrada via importação XML Fiscal (NF-e ${numNFE})`,
          }
        });
      }

      // 3. Process Financial Record (Contas a Pagar)
      let dueDate = new Date();
      const cobr = infNFe.cobr;
      if (cobr && cobr.dup) {
        let dup = cobr.dup;
        if (Array.isArray(dup)) dup = dup[0]; // Take the first installment if multiple
        if (dup.dVenc) {
          dueDate = new Date(dup.dVenc); // YYYY-MM-DD
        }
      }

      // Ensure we use the total of the invoice properly
      const vNF = infNFe.total?.ICMSTot?.vNF;
      if (vNF) {
          invoiceTotal = parseFloat(vNF);
      }

      const financialRecord = await this.prisma.financialRecord.create({
        data: {
          tenantId,
          description: `NF-e ${numNFE} - ${razaoSocial}`,
          amount: invoiceTotal,
          dueDate: dueDate,
          status: 'PENDING',
          type: 'EXPENSE',
          category: 'COMPRAS_XML',
        }
      });
      
      // Save Invoice Document inside DB
      await this.prisma.invoice.create({
          data: {
            tenantId,
            contactId: contact.id, // Linked to the Contact instead of Supplier
            number: String(numNFE),
            accessKey: infNFe.Id ? String(infNFe.Id).replace('NFe', '') : null,
            xmlContent: xmlContent,
            type: 'INPUT',
            status: 'AUTHORIZED',
            financialId: financialRecord.id
          }
      });

      return { 
          success: true, 
          message: `XML da NF-e ${numNFE} importado com sucesso! Fornecedor e ${det.length} produtos atualizados no estoque.`
      };
      
    } catch (error: any) {
      console.error('[FiscalService] Erro ao processar XML:', error);
      throw new BadRequestException('Falha no processamento: ' + error.message);
    }
  }
}
