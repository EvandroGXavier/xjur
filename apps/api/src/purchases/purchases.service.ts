import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async parseXmlPreview(tenantId: string, xmlContent: string) {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(xmlContent);

    const nfeProc = parsed.nfeProc || parsed.NFeProc;
    const nfe = nfeProc?.NFe?.infNFe;
    
    if (!nfe) throw new BadRequestException('O arquivo enviado não parece ser um XML válido de NF-e.');

    const { emit, dest, det, cobr, ide, total } = nfe;
    const dets = Array.isArray(det) ? det : [det];
    const dups = cobr?.dup ? (Array.isArray(cobr.dup) ? cobr.dup : [cobr.dup]) : [];

    const doc = String(emit.CNPJ || emit.CPF || '').replace(/\D/g, '');
    let contact = await this.prisma.contact.findFirst({ where: { tenantId, document: doc } });

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          tenantId,
          name: emit.xNome,
          document: doc,
          personType: emit.CNPJ ? 'PJ' : 'PF',
          category: 'Fornecedor',
        },
      });

      if (emit.CNPJ) {
        await this.prisma.personDetailPJ.create({
          data: { contactId: contact.id, cnpj: doc, companyName: emit.xNome },
        });
      }
    }

    const invoiceKey = nfe['@_Id']?.replace('NFe', '');
    if (invoiceKey) {
      const existingInvoice = await this.prisma.invoice.findFirst({
         where: { tenantId, accessKey: invoiceKey }
      });
      if (existingInvoice) throw new BadRequestException(`A NF-e ${ide.nNF} já foi importada anteriormente.`);
    }

    const items = [];
    for (const item of dets) {
      const p = item.prod;
      const code = String(p.cProd);
      const name = String(p.xProd);
      const qCom = parseFloat(p.qCom);
      const vUnCom = parseFloat(p.vUnCom);

      let product = await this.prisma.product.findFirst({
        where: { tenantId, OR: [{ sku: code }, { name: name }] },
      });

      if (!product) {
        product = await this.prisma.product.create({
          data: {
            tenantId,
            name: name,
            sku: code,
            barcode: p.cEAN !== 'SEM GTIN' ? String(p.cEAN) : null,
            ncm: String(p.NCM),
            cest: p.CEST ? String(p.CEST) : null,
            unit: String(p.uCom),
            currentStock: 0,
            type: 'PRODUCT',
            costPrice: vUnCom,
            supplierId: contact.id,
          },
        });
      }

      items.push({
        productId: product.id,
        quantity: qCom,
        unitCost: vUnCom,
        discount: 0,
        total: parseFloat(p.vProd),
        _productName: name // For frontend preview only
      });
    }

    return {
      contactId: contact.id,
      expectedDate: ide.dhEmi ? new Date(ide.dhEmi).toISOString() : null,
      notes: `Ref. NFe: ${ide.nNF}`,
      items,
      xmlData: {
        xmlContent,
        accessKey: invoiceKey,
        number: ide.nNF,
        dups,
        supplierName: emit.xNome,
        invoiceTotal: parseFloat(total?.ICMSTot?.vNF || '0')
      }
    };
  }

  async create(tenantId: string, data: any) {
    const { contactId, totalAmount, notes, expectedDate, deliveryDate, paymentCondition, items, xmlData } = data;
    
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Purchase Order
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          tenantId,
          contactId,
          status: xmlData ? 'RECEIVED' : 'QUOTATION',
          totalAmount,
          notes,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          paymentCondition,
          items: {
            create: items?.map((i: any) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost || i.unitPrice,
              discount: i.discount || 0,
              total: i.total,
            })) || []
          }
        },
        include: { items: true, contact: true }
      });

      if (xmlData) {
         // Create Invoice
         const invoice = await tx.invoice.create({
            data: {
              tenantId,
              purchaseOrderId: purchaseOrder.id,
              contactId: purchaseOrder.contactId,
              number: String(xmlData.number),
              accessKey: xmlData.accessKey,
              type: 'INPUT',
              status: 'AUTHORIZED',
              xmlContent: xmlData.xmlContent,
            }
         });

         // Update Products Stock & Cost, Create Inventory Movements
         for (const item of purchaseOrder.items) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (product && product.type === 'PRODUCT') {
              await tx.product.update({
                where: { id: product.id },
                data: { 
                   currentStock: product.currentStock + item.quantity,
                   costPrice: item.unitCost 
                }
              });

              await tx.inventoryMovement.create({
                data: {
                  tenantId,
                  productId: product.id,
                  type: 'IN',
                  quantity: item.quantity,
                  unitPrice: item.unitCost,
                  totalPrice: item.total,
                  reason: `Entrada - Automático via Compra #${purchaseOrder.code}`,
                }
              });
            }
         }

         // Generate Accounts Payable
         if (xmlData.dups?.length > 0) {
            for (const dup of xmlData.dups) {
              await tx.financialRecord.create({
                data: {
                  tenantId,
                  description: `Fornecedor ${xmlData.supplierName || ''} - NF ${xmlData.number} Parcela ${dup.nDup}`,
                  amount: parseFloat(dup.vDup),
                  dueDate: new Date(String(dup.dVenc)),
                  status: 'PENDING',
                  type: 'EXPENSE',
                  category: 'FORNECEDORES / COMPRAS',
                  notes: `Ref. NFe: ${xmlData.accessKey}`,
                  invoice: { connect: { id: invoice.id } },
                  parties: {
                    create: [ { tenantId, contactId: purchaseOrder.contactId, role: 'CREDITOR' } ]
                  }
                },
              });
            }
         } else if (xmlData.invoiceTotal > 0) {
            await tx.financialRecord.create({
              data: {
                tenantId,
                description: `Para ${xmlData.supplierName || ''} - NF ${xmlData.number} (À Vista)`,
                amount: xmlData.invoiceTotal,
                dueDate: new Date(),
                status: 'PENDING',
                type: 'EXPENSE',
                category: 'FORNECEDORES / COMPRAS',
                notes: `Ref. NFe: ${xmlData.accessKey}`,
                invoice: { connect: { id: invoice.id } },
                parties: {
                  create: [ { tenantId, contactId: purchaseOrder.contactId, role: 'CREDITOR' } ]
                }
              }
            });
         }
      }

      return purchaseOrder;
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { contact: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: { include: { product: true } }, contact: true, invoice: true }
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const { contactId, totalAmount, notes, expectedDate, deliveryDate, paymentCondition, items } = data;
    
    // Verify ownership
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!existing) throw new BadRequestException('Pedido de Compra não encontrado');

    return this.prisma.$transaction(async (tx) => {
      // Clear previous items to replace with new ones
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          contactId,
          totalAmount,
          notes,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          paymentCondition,
          items: {
            create: items?.map((i: any) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost || i.unitPrice,
              discount: i.discount || 0,
              total: i.total,
            })) || []
          }
        },
        include: { items: true }
      });
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!existing) throw new BadRequestException('Pedido de Compra não encontrado');
    return this.prisma.purchaseOrder.delete({ where: { id } });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: true, contact: true }
      });

      if (!purchaseOrder) throw new BadRequestException('Pedido de compra não encontrado');

      if (purchaseOrder.status === 'RECEIVED' && status === 'RECEIVED') {
        throw new BadRequestException('Este pedido já foi dado entrada/recebido');
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status }
      });

      // Se virou RECEBIDO (Entrada de Estoque e AP)
      if (status === 'RECEIVED') {
        // 1. Generate Financial Record (Despesa / Contas a Pagar)
        const financialRecord = await tx.financialRecord.create({
          data: {
            tenantId,
            description: `Compra / Cotação #${purchaseOrder.code} - Fornecedor: ${purchaseOrder.contact.name}`,
            amount: purchaseOrder.totalAmount,
            dueDate: new Date(),
            status: 'PENDING',
            type: 'EXPENSE',
            category: 'FORNECEDORES / COMPRAS',
          }
        });

        // 2. Setup Invoice (Entrada)
        await tx.invoice.create({
          data: {
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            contactId: purchaseOrder.contactId,
            type: 'INPUT',
            status: 'PENDING',
            financialId: financialRecord.id,
          }
        });

        // 3. Inventory movements (Entrada) e Custo de Compra
        for (const item of purchaseOrder.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product && product.type === 'PRODUCT') {
            await tx.product.update({
              where: { id: product.id },
              data: { 
                 currentStock: product.currentStock + item.quantity,
                 costPrice: item.unitCost // Atualiza custo da ultima compra
              }
            });

            await tx.inventoryMovement.create({
              data: {
                tenantId,
                productId: product.id,
                type: 'IN',
                quantity: item.quantity,
                unitPrice: item.unitCost,
                totalPrice: item.total,
                reason: `Entrada - Automático via Compra #${purchaseOrder.code}`,
              }
            });
          }
        }
      }

      return updated;
    });
  }
}
