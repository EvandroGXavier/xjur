import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StockService } from "../stock/stock.service";
import { FiscalService } from "../fiscal/fiscal.service";

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly fiscalService: FiscalService,
  ) {}

  async create(tenantId: string, data: any) {
    const {
      contactId,
      sellerId,
      totalAmount,
      notes,
      validUntil,
      deliveryDate,
      salesperson,
      special,
      paymentCondition,
      paymentConditionId,
      items,
    } = data;

    return this.prisma.proposal.create({
      data: {
        tenantId,
        contactId,
        sellerId,
        status: "DRAFT",
        totalAmount,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        salesperson,
        special: special || false,
        paymentCondition,
        paymentConditionId,
        items: {
          create:
            items?.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.total,
            })) || [],
        },
      },
      include: { items: true },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.proposal.findMany({
      where: { tenantId },
      include: {
        contact: true,
        seller: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(tenantId: string, id: string) {
    return this.prisma.proposal.findFirst({
      where: { id, tenantId },
      include: {
        items: { include: { product: true } },
        contact: true,
        seller: true,
        invoices: {
          include: {
            items: true,
            events: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        financialRecords: true,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const {
      totalAmount,
      notes,
      validUntil,
      deliveryDate,
      salesperson,
      special,
      paymentCondition,
      paymentConditionId,
      items,
    } = data;

    const existing = await this.prisma.proposal.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new BadRequestException("Orcamento nao encontrado");
    }

    if (["APPROVED", "INVOICED"].includes(existing.status)) {
      throw new BadRequestException(
        "Orcamentos faturados nao podem ser editados. Exclua ou cancele o registro para estornar.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.proposalItem.deleteMany({ where: { proposalId: id } });

      return tx.proposal.update({
        where: { id },
        data: {
          contactId: data.contactId,
          sellerId: data.sellerId,
          totalAmount,
          notes,
          validUntil: validUntil ? new Date(validUntil) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          salesperson,
          special: special || false,
          paymentCondition,
          paymentConditionId,
          items: {
            create:
              items?.map((item: any) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
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
      const existing = await tx.proposal.findFirst({
        where: { id, tenantId },
        include: { items: true, invoices: true },
      });

      if (!existing) {
        throw new BadRequestException("Orcamento nao encontrado");
      }

      if (["APPROVED", "INVOICED"].includes(existing.status)) {
        for (const item of existing.items) {
          await this.stockService.applyMovement(tx, {
            tenantId,
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.total),
            reason: `Estorno - Orcamento Cancelado #${existing.code}`,
            skipIfService: true,
          });
        }
      }

      await tx.invoice.deleteMany({
        where: { proposalId: id },
      });

      await tx.financialRecord.deleteMany({
        where: { proposalId: id },
      });

      await tx.proposalItem.deleteMany({ where: { proposalId: id } });
      return tx.proposal.delete({ where: { id } });
    });
  }

  async bill(tenantId: string, id: string, data: any) {
    const emitFiscal = Boolean(data?.emitFiscal);
    const billingResult = await this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.findFirst({
        where: { id, tenantId },
        include: {
          items: {
            include: { product: true },
          },
          contact: {
            include: {
              pjDetails: true,
              pfDetails: true,
              addresses: true,
            },
          },
          seller: true,
          invoices: true,
          financialRecords: true,
        },
      });

      if (!proposal) {
        throw new BadRequestException("Orcamento nao encontrado");
      }

      if (["APPROVED", "INVOICED"].includes(proposal.status)) {
        throw new BadRequestException(
          "Este orcamento ja foi faturado anteriormente.",
        );
      }

      const readiness = this.fiscalService.evaluateProposalReadinessFromData(
        await this.fiscalService.getConfig(tenantId),
        proposal,
      );

      const issueProducts =
        data?.issueProducts !== undefined
          ? Boolean(data.issueProducts)
          : readiness.hasProducts;
      const issueServices =
        data?.issueServices !== undefined
          ? Boolean(data.issueServices)
          : readiness.hasServices;

      if (emitFiscal) {
        if (issueProducts && readiness.hasProducts && !readiness.canIssueNfe) {
          throw new BadRequestException(
            "A proposta nao esta pronta para emitir NF-e de produtos.",
          );
        }

        if (issueServices && readiness.hasServices && !readiness.canIssueNfse) {
          throw new BadRequestException(
            "A proposta nao esta pronta para emitir NFS-e de servicos.",
          );
        }
      }

      const mainFinancialId = await this.ensureFinancialRecords(
        tx,
        tenantId,
        proposal,
      );

      await this.ensureInvoiceDrafts(tx, tenantId, proposal, {
        emitFiscal,
        issueProducts,
        issueServices,
        readiness,
        mainFinancialId,
      });

      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: "APPROVED",
        },
      });

      for (const item of proposal.items) {
        await this.stockService.applyMovement(tx, {
          tenantId,
          productId: item.productId,
          type: "OUT",
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.total),
          reason: `Venda - Automatico via Orcamento #${proposal.code}`,
          skipIfService: true,
        });
      }

      const refreshed = await tx.proposal.findFirst({
        where: { id: proposal.id, tenantId },
        include: {
          items: { include: { product: true } },
          contact: true,
          seller: true,
          invoices: {
            include: {
              items: true,
              events: {
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          financialRecords: true,
        },
      });

      return {
        proposal: refreshed,
        readiness,
        message: emitFiscal
          ? "Venda faturada e documentos fiscais preparados para transmissao."
          : "Venda faturada sem emissao fiscal. Documentos ficaram como rascunho.",
        transmissionMode: emitFiscal ? "PREPARED" : "SKIPPED",
      };
    });

    if (emitFiscal) {
      const transmissionOptions = {
        issueProducts:
          data?.issueProducts !== undefined
            ? Boolean(data.issueProducts)
            : Boolean(billingResult.readiness?.hasProducts),
        issueServices:
          data?.issueServices !== undefined
            ? Boolean(data.issueServices)
            : Boolean(billingResult.readiness?.hasServices),
      };

      const transmission = await this.fiscalService.transmitProposalInvoices(
        tenantId,
        id,
        transmissionOptions,
      );

      const refreshed = await this.findOne(tenantId, id);

      return {
        ...billingResult,
        proposal: refreshed,
        transmissionMode: transmission.transmissionMode,
        transmission,
        message:
          transmission.transmissionMode === 'AUTHORIZED'
            ? 'Venda faturada e documentos fiscais autorizados.'
            : transmission.transmissionMode === 'PARTIAL'
              ? 'Venda faturada com autorizacao parcial dos documentos fiscais.'
              : 'Venda faturada, mas a transmissao fiscal retornou rejeicoes.',
      };
    }

    return billingResult;
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    if (status === "APPROVED") {
      return this.bill(tenantId, id, {
        emitFiscal: false,
        issueProducts: false,
        issueServices: false,
      });
    }

    const proposal = await this.prisma.proposal.findFirst({
      where: { id, tenantId },
    });

    if (!proposal) {
      throw new BadRequestException("Orcamento nao encontrado");
    }

    if (["APPROVED", "INVOICED"].includes(proposal.status)) {
      throw new BadRequestException(
        "Orcamentos faturados nao podem mudar de status.",
      );
    }

    return this.prisma.proposal.update({
      where: { id },
      data: { status },
    });
  }

  private async ensureFinancialRecords(
    tx: any,
    tenantId: string,
    proposal: any,
  ) {
    if (proposal.financialRecords?.length > 0) {
      return proposal.financialRecords[0].id;
    }

    let customInstallments = null;
    if (
      proposal.paymentCondition &&
      proposal.paymentCondition.startsWith("[")
    ) {
      try {
        customInstallments = JSON.parse(proposal.paymentCondition);
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
            description: `Venda Ref. Orcamento #${proposal.code} - Parcela ${installment.installment || i + 1}/${customInstallments.length} - ${proposal.contact.name}`,
            amount: parseFloat(installment.amount),
            dueDate: new Date(installment.dueDate),
            status: "PENDING",
            type: "INCOME",
            category: "VENDAS",
            installmentNumber: installment.installment || i + 1,
            totalInstallments: customInstallments.length,
            paymentConditionId: proposal.paymentConditionId || null,
            proposalId: proposal.id,
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
          description: `Venda Ref. Orcamento #${proposal.code} - ${proposal.contact.name}`,
          amount: proposal.totalAmount,
          dueDate: new Date(),
          status: "PENDING",
          type: "INCOME",
          category: "VENDAS",
          proposalId: proposal.id,
        },
      });
      mainFinancialId = financialRecord.id;
    }

    return mainFinancialId;
  }

  private async ensureInvoiceDrafts(
    tx: any,
    tenantId: string,
    proposal: any,
    options: {
      emitFiscal: boolean;
      issueProducts: boolean;
      issueServices: boolean;
      readiness: any;
      mainFinancialId?: string | null;
    },
  ) {
    const config = await this.fiscalService.getConfig(tenantId);
    const productItems = proposal.items.filter(
      (item: any) => item.product?.type !== "SERVICE",
    );
    const serviceItems = proposal.items.filter(
      (item: any) => item.product?.type === "SERVICE",
    );

    await tx.invoice.deleteMany({
      where: {
        proposalId: proposal.id,
        status: {
          notIn: ["AUTHORIZED", "PARTIALLY_AUTHORIZED"],
        },
      },
    });

    const scopes: Array<{
      scope: "PRODUCTS" | "SERVICES";
      documentModel: "NFE" | "NFSE";
      items: any[];
      shouldPrepareTransmission: boolean;
      readinessIssues: any[];
    }> = [];

    if (productItems.length > 0) {
      scopes.push({
        scope: "PRODUCTS",
        documentModel: "NFE",
        items: productItems,
        shouldPrepareTransmission: options.emitFiscal && options.issueProducts,
        readinessIssues: options.readiness.nfeIssues,
      });
    }

    if (serviceItems.length > 0) {
      scopes.push({
        scope: "SERVICES",
        documentModel: "NFSE",
        items: serviceItems,
        shouldPrepareTransmission: options.emitFiscal && options.issueServices,
        readinessIssues: options.readiness.nfseIssues,
      });
    }

    for (let index = 0; index < scopes.length; index++) {
      const scopeEntry = scopes[index];
      const totalAmount = scopeEntry.items.reduce(
        (sum: number, item: any) => sum + Number(item.total),
        0,
      );

      await tx.invoice.create({
        data: {
          tenantId,
          proposalId: proposal.id,
          contactId: proposal.contactId,
          documentModel: scopeEntry.documentModel,
          direction: "OUTPUT",
          scope: scopeEntry.scope,
          environment: config.environment,
          provider:
            scopeEntry.documentModel === "NFSE"
              ? config.provedorNfse || "BH"
              : "SEFAZ",
          providerCityCode:
            scopeEntry.documentModel === "NFSE"
              ? config.codigoMunicipioIbge
              : config.webserviceUf,
          series:
            scopeEntry.documentModel === "NFSE"
              ? config.serieNfse
              : config.serieNfe,
          issueDate: new Date(),
          operationNature:
            scopeEntry.documentModel === "NFSE"
              ? "Prestacao de servicos"
              : "Venda de mercadorias",
          requestPayload: {
            proposalId: proposal.id,
            proposalCode: proposal.code,
            totalAmount,
            mode: scopeEntry.shouldPrepareTransmission ? "READY" : "DRAFT",
          },
          readinessIssues: scopeEntry.readinessIssues,
          type: "OUTPUT",
          status: scopeEntry.shouldPrepareTransmission ? "READY" : "DRAFT",
          financialId: index === 0 ? options.mainFinancialId || null : null,
          items: {
            create: scopeEntry.items.map((item: any) => ({
              productId: item.productId,
              description: item.product?.name || "Item da proposta",
              quantity: item.quantity,
              unit: item.product?.unit || "UN",
              unitPrice: item.unitPrice,
              grossAmount: item.total,
              discountAmount: item.discount || 0,
              netAmount: item.total,
              cfop: item.product?.defaultCfopSale || null,
              ncm: item.product?.ncm || null,
              cest: item.product?.cest || null,
              serviceCode:
                item.product?.serviceCode ||
                item.product?.serviceCodeMunicipal ||
                null,
              serviceCodeMunicipal: item.product?.serviceCodeMunicipal || null,
              nbs: item.product?.nbs || null,
              origin: item.product?.originCode || null,
              cst: item.product?.cstIcms || null,
              csosn: item.product?.csosn || null,
              icmsRate: item.product?.icmsRate || null,
              pisCst: item.product?.cstPis || null,
              pisRate: item.product?.pisRate || null,
              cofinsCst: item.product?.cstCofins || null,
              cofinsRate: item.product?.cofinsRate || null,
              ipiRate: item.product?.ipiRate || null,
              issRate: item.product?.issRate || null,
            })),
          },
          events: {
            create: {
              type: "VALIDATION",
              status: scopeEntry.shouldPrepareTransmission ? "READY" : "DRAFT",
              payload: {
                scope: scopeEntry.scope,
                documentModel: scopeEntry.documentModel,
                proposalCode: proposal.code,
                issues: scopeEntry.readinessIssues,
              },
            },
          },
        },
      });
    }
  }
}
