import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { XMLParser } from "fast-xml-parser";
import { StockService } from "../stock/stock.service";

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
  ) {}

  async parseXmlPreview(tenantId: string, xmlContent: string) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const parsed = parser.parse(xmlContent);

    const nfeProc = parsed.nfeProc || parsed.NFeProc;
    const nfe = nfeProc?.NFe?.infNFe;

    if (!nfe) {
      throw new BadRequestException(
        "O arquivo enviado nao parece ser um XML valido de NF-e.",
      );
    }

    const { emit, det, cobr, ide, total } = nfe;
    const itemsXml = Array.isArray(det) ? det : [det];
    const dups = cobr?.dup
      ? Array.isArray(cobr.dup)
        ? cobr.dup
        : [cobr.dup]
      : [];

    const supplierDocument = String(emit.CNPJ || emit.CPF || "").replace(
      /\D/g,
      "",
    );
    let contact = await this.prisma.contact.findFirst({
      where: { tenantId, document: supplierDocument },
    });

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          tenantId,
          name: emit.xNome,
          document: supplierDocument,
          personType: emit.CNPJ ? "PJ" : "PF",
          category: "Fornecedor",
        },
      });

      if (emit.CNPJ) {
        await this.prisma.personDetailPJ.create({
          data: {
            contactId: contact.id,
            cnpj: supplierDocument,
            companyName: emit.xNome,
          },
        });
      }
    }

    const invoiceKey = nfe["@_Id"]?.replace("NFe", "");
    if (invoiceKey) {
      const existingInvoice = await this.prisma.invoice.findFirst({
        where: { tenantId, accessKey: invoiceKey },
      });

      if (existingInvoice) {
        throw new BadRequestException(
          `A NF-e ${ide.nNF} ja foi importada anteriormente.`,
        );
      }
    }

    const items = [];

    for (const item of itemsXml) {
      const productXml = item.prod;
      const code = String(productXml.cProd);
      const name = String(productXml.xProd);
      const quantity = parseInt(productXml.qCom, 10);
      const unitCost = parseFloat(productXml.vUnCom);

      let product = await this.prisma.product.findFirst({
        where: { tenantId, OR: [{ sku: code }, { name }] },
      });

      if (!product) {
        product = await this.prisma.product.create({
          data: {
            tenantId,
            name,
            sku: code,
            barcode:
              productXml.cEAN !== "SEM GTIN" ? String(productXml.cEAN) : null,
            ncm: String(productXml.NCM),
            cest: productXml.CEST ? String(productXml.CEST) : null,
            unit: String(productXml.uCom),
            currentStock: 0,
            type: "PRODUCT",
            costPrice: unitCost,
            supplierId: contact.id,
          },
        });
      }

      items.push({
        productId: product.id,
        quantity,
        unitCost,
        discount: 0,
        total: parseFloat(productXml.vProd),
        _productName: name,
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
        invoiceTotal: parseFloat(total?.ICMSTot?.vNF || "0"),
      },
    };
  }

  async create(tenantId: string, data: any) {
    const {
      contactId,
      buyerId,
      totalAmount,
      notes,
      expectedDate,
      deliveryDate,
      paymentCondition,
      paymentConditionId,
      items,
      xmlData,
    } = data;

    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          tenantId,
          contactId,
          buyerId: buyerId || null,
          status: xmlData ? "RECEIVED" : "QUOTATION",
          totalAmount,
          notes,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          paymentCondition,
          paymentConditionId,
          items: {
            create:
              items?.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost || item.unitPrice,
                discount: item.discount || 0,
                total: item.total,
              })) || [],
          },
        },
        include: { items: true, contact: true },
      });

      if (!xmlData) {
        return purchaseOrder;
      }

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          purchaseOrderId: purchaseOrder.id,
          contactId: purchaseOrder.contactId,
          number: String(xmlData.number),
          accessKey: xmlData.accessKey,
          type: "INPUT",
          status: "AUTHORIZED",
          xmlContent: xmlData.xmlContent,
        },
      });

      for (const item of purchaseOrder.items) {
        await this.stockService.applyMovement(tx, {
          tenantId,
          productId: item.productId,
          type: "IN",
          quantity: item.quantity,
          unitPrice: Number(item.unitCost),
          totalPrice: Number(item.total),
          reason: `Entrada - Automatico via Compra #${purchaseOrder.code}`,
          skipIfService: true,
          productUpdates: {
            costPrice: Number(item.unitCost),
          },
        });
      }

      let customInstallments = null;
      if (paymentCondition && paymentCondition.startsWith("[")) {
        try {
          customInstallments = JSON.parse(paymentCondition);
        } catch {
          customInstallments = null;
        }
      }

      if (
        customInstallments &&
        Array.isArray(customInstallments) &&
        customInstallments.length > 0
      ) {
        for (let i = 0; i < customInstallments.length; i++) {
          const installment = customInstallments[i];
          await tx.financialRecord.create({
            data: {
              tenantId,
              description: `Fornecedor ${xmlData.supplierName || ""} - NF ${xmlData.number} Parcela ${installment.installment || i + 1}/${customInstallments.length}`,
              amount: parseFloat(installment.amount),
              dueDate: new Date(installment.dueDate),
              status: "PENDING",
              type: "EXPENSE",
              category: "FORNECEDORES / COMPRAS",
              notes: `Ref. NFe: ${xmlData.accessKey}`,
              installmentNumber: installment.installment || i + 1,
              totalInstallments: customInstallments.length,
              paymentConditionId: paymentConditionId || null,
              purchaseOrderId: purchaseOrder.id,
              invoice: i === 0 ? { connect: { id: invoice.id } } : undefined,
              parties: {
                create: this.buildParties(
                  tenantId,
                  purchaseOrder.contactId,
                  purchaseOrder.buyerId,
                ),
              },
            },
          });
        }
      } else if (xmlData.dups?.length > 0) {
        for (let i = 0; i < xmlData.dups.length; i++) {
          const duplicate = xmlData.dups[i];
          await tx.financialRecord.create({
            data: {
              tenantId,
              description: `Fornecedor ${xmlData.supplierName || ""} - NF ${xmlData.number} Parcela ${duplicate.nDup}`,
              amount: parseFloat(duplicate.vDup),
              dueDate: new Date(String(duplicate.dVenc)),
              status: "PENDING",
              type: "EXPENSE",
              category: "FORNECEDORES / COMPRAS",
              notes: `Ref. NFe: ${xmlData.accessKey}`,
              purchaseOrderId: purchaseOrder.id,
              invoice: i === 0 ? { connect: { id: invoice.id } } : undefined,
              parties: {
                create: this.buildParties(
                  tenantId,
                  purchaseOrder.contactId,
                  purchaseOrder.buyerId,
                ),
              },
            },
          });
        }
      } else if (xmlData.invoiceTotal > 0) {
        await tx.financialRecord.create({
          data: {
            tenantId,
            description: `Para ${xmlData.supplierName || ""} - NF ${xmlData.number} (A Vista)`,
            amount: xmlData.invoiceTotal,
            dueDate: new Date(),
            status: "PENDING",
            type: "EXPENSE",
            category: "FORNECEDORES / COMPRAS",
            notes: `Ref. NFe: ${xmlData.accessKey}`,
            purchaseOrderId: purchaseOrder.id,
            invoice: { connect: { id: invoice.id } },
            parties: {
              create: this.buildParties(
                tenantId,
                purchaseOrder.contactId,
                purchaseOrder.buyerId,
              ),
            },
          },
        });
      }

      return purchaseOrder;
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { contact: true, buyer: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: { include: { product: true } },
        contact: true,
        buyer: true,
        invoice: true,
        financialRecords: {
          orderBy: { dueDate: "asc" },
        },
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const {
      contactId,
      buyerId,
      totalAmount,
      notes,
      expectedDate,
      deliveryDate,
      paymentCondition,
      paymentConditionId,
      items,
    } = data;

    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new BadRequestException("Pedido de Compra nao encontrado");
    }

    if (existing.status === "RECEIVED") {
      throw new BadRequestException(
        "Pedidos recebidos nao podem ser editados sem estorno.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          contactId,
          buyerId: buyerId || null,
          totalAmount,
          notes,
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          paymentCondition,
          paymentConditionId,
          items: {
            create:
              items?.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost || item.unitPrice,
                discount: item.discount || 0,
                total: item.total,
              })) || [],
          },
        },
        include: { items: true },
      });
    });
  }

  async remove(tenantId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: true, invoice: true },
      });

      if (!existing) {
        throw new BadRequestException("Pedido de Compra nao encontrado");
      }

      if (existing.status === "RECEIVED") {
        for (const item of existing.items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (product && product.type === "PRODUCT") {
            await tx.product.update({
              where: { id: product.id },
              data: { currentStock: product.currentStock - item.quantity },
            });
            await tx.inventoryMovement.deleteMany({
              where: {
                tenantId,
                productId: product.id,
                reason: { contains: existing.code.toString() },
              },
            });
          }
        }
      }

      if (existing.invoice) {
        await tx.invoice.delete({ where: { id: existing.invoice.id } });
      }

      await tx.financialRecord.deleteMany({
        where: { tenantId, purchaseOrderId: id },
      });

      return tx.purchaseOrder.delete({ where: { id } });
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { items: true, contact: true },
      });

      if (!purchaseOrder) {
        throw new BadRequestException("Pedido de compra nao encontrado");
      }

      if (purchaseOrder.status === "RECEIVED") {
        throw new BadRequestException(
          status === "RECEIVED"
            ? "Este pedido ja foi dado entrada/recebido"
            : "Pedidos recebidos nao podem mudar de status.",
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status },
      });

      if (status === "RECEIVED") {
        let customInstallments = null;
        if (
          purchaseOrder.paymentCondition &&
          purchaseOrder.paymentCondition.startsWith("[")
        ) {
          try {
            customInstallments = JSON.parse(purchaseOrder.paymentCondition);
          } catch {
            customInstallments = null;
          }
        }

        let mainFinancialId = null;

        if (
          customInstallments &&
          Array.isArray(customInstallments) &&
          customInstallments.length > 0
        ) {
          for (let i = 0; i < customInstallments.length; i++) {
            const installment = customInstallments[i];
            const financialRecord = await tx.financialRecord.create({
              data: {
                tenantId,
                description: `Compra / Cotacao #${purchaseOrder.code} - Parcela ${installment.installment || i + 1}/${customInstallments.length} - ${purchaseOrder.contact.name}`,
                amount: parseFloat(installment.amount),
                dueDate: new Date(installment.dueDate),
                status: "PENDING",
                type: "EXPENSE",
                category: "FORNECEDORES / COMPRAS",
                installmentNumber: installment.installment || i + 1,
                totalInstallments: customInstallments.length,
                paymentConditionId: purchaseOrder.paymentConditionId || null,
                purchaseOrderId: purchaseOrder.id,
                parties: {
                  create: this.buildParties(
                    tenantId,
                    purchaseOrder.contactId,
                    purchaseOrder.buyerId,
                  ),
                },
              },
            });
            if (i === 0) {
              mainFinancialId = financialRecord.id;
            }
          }
        } else {
          const financialRecord = await tx.financialRecord.create({
            data: {
              tenantId,
              description: `Compra / Cotacao #${purchaseOrder.code} - Fornecedor: ${purchaseOrder.contact.name}`,
              amount: purchaseOrder.totalAmount,
              dueDate: new Date(),
              status: "PENDING",
              type: "EXPENSE",
              category: "FORNECEDORES / COMPRAS",
              purchaseOrderId: purchaseOrder.id,
              parties: {
                create: this.buildParties(
                  tenantId,
                  purchaseOrder.contactId,
                  purchaseOrder.buyerId,
                ),
              },
            },
          });
          mainFinancialId = financialRecord.id;
        }

        await tx.invoice.create({
          data: {
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            contactId: purchaseOrder.contactId,
            type: "INPUT",
            status: "PENDING",
            financialId: mainFinancialId,
          },
        });

        for (const item of purchaseOrder.items) {
          await this.stockService.applyMovement(tx, {
            tenantId,
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            unitPrice: Number(item.unitCost),
            totalPrice: Number(item.total),
            reason: `Entrada - Automatico via Compra #${purchaseOrder.code}`,
            skipIfService: true,
            productUpdates: {
              costPrice: Number(item.unitCost),
            },
          });
        }
      }

      return updated;
    });
  }

  private buildParties(
    tenantId: string,
    creditorId: string,
    debtorId?: string | null,
  ) {
    return [
      {
        tenantId,
        contactId: creditorId,
        role: "CREDITOR",
      },
      ...(debtorId
        ? [
            {
              tenantId,
              contactId: debtorId,
              role: "DEBTOR",
            },
          ]
        : []),
    ];
  }
}
