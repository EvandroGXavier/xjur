import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { XMLParser } from 'fast-xml-parser';
import { StockService } from '../stock/stock.service';
import { isValidCnpj, normalizeDigits } from '../common/validation-utils';
import { SecurityService } from '../security/security.service';
import { NfeGatewayService } from './nfe-gateway.service';
import { BhNfseGatewayService } from './providers/bh-nfse/bh-nfse.gateway';

@Injectable()
export class FiscalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly securityService: SecurityService,
    private readonly nfeGatewayService: NfeGatewayService,
    private readonly bhNfseGatewayService: BhNfseGatewayService,
  ) {}

  async getConfig(tenantId: string) {
    let config = await this.prisma.fiscalConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      config = await this.prisma.fiscalConfig.create({
        data: { tenantId },
      });
    }

    return config;
  }

  async updateConfig(tenantId: string, data: any) {
    const current = await this.getConfig(tenantId);
    let securitySecretId = current.securitySecretId || null;

    if (data.certificatePassword || data.certificateUsername || data.certificateDescription) {
      if (securitySecretId) {
        await this.securityService.updateSecret(securitySecretId, tenantId, {
          description:
            data.certificateDescription || 'Certificado fiscal A1',
          username: data.certificateUsername || null,
          password: data.certificatePassword || undefined,
          expiresAt: data.certificateExpiresAt
            ? new Date(data.certificateExpiresAt)
            : undefined,
        });
      } else {
        const secret = await this.securityService.createSecret(tenantId, {
          entityType: 'FISCAL_CONFIG',
          entityId: current.id,
          description: data.certificateDescription || 'Certificado fiscal A1',
          username: data.certificateUsername || null,
          password: data.certificatePassword || null,
          expiresAt: data.certificateExpiresAt
            ? new Date(data.certificateExpiresAt)
            : null,
        });
        securitySecretId = secret.id;
      }
    }

    return this.prisma.fiscalConfig.upsert({
      where: { tenantId },
      update: {
        razaoSocialEmitente: data.razaoSocialEmitente,
        nomeFantasiaEmitente: data.nomeFantasiaEmitente,
        cnpjEmitente: data.cnpjEmitente,
        ieEmitente: data.ieEmitente,
        imEmitente: data.imEmitente,
        crt: data.crt,
        regimeTributario: data.regimeTributario,
        serieNfe: data.serieNfe ? Number(data.serieNfe) : undefined,
        serieNfse: data.serieNfse ? Number(data.serieNfse) : undefined,
        proximoNumeroNfe: data.proximoNumeroNfe
          ? Number(data.proximoNumeroNfe)
          : undefined,
        proximoNumeroNfse: data.proximoNumeroNfse
          ? Number(data.proximoNumeroNfse)
          : undefined,
        proximoNumeroRps: data.proximoNumeroRps
          ? Number(data.proximoNumeroRps)
          : undefined,
        codigoMunicipioIbge: data.codigoMunicipioIbge,
        codigoMunicipioNfse: data.codigoMunicipioNfse,
        provedorNfse: data.provedorNfse,
        webserviceUf: data.webserviceUf,
        environment: data.environment,
        certificateStorageProvider: data.certificateStorageProvider,
        certificateFileUrl: data.certificateFileUrl,
        certificateLastSyncAt: data.certificateLastSyncAt
          ? new Date(data.certificateLastSyncAt)
          : undefined,
        certificateExpiresAt: data.certificateExpiresAt
          ? new Date(data.certificateExpiresAt)
          : undefined,
        certificateSerialNumber: data.certificateSerialNumber,
        securitySecretId,
      },
      create: {
        tenantId,
        razaoSocialEmitente: data.razaoSocialEmitente,
        nomeFantasiaEmitente: data.nomeFantasiaEmitente,
        cnpjEmitente: data.cnpjEmitente,
        ieEmitente: data.ieEmitente,
        imEmitente: data.imEmitente,
        crt: data.crt,
        regimeTributario: data.regimeTributario,
        serieNfe: data.serieNfe ? Number(data.serieNfe) : 1,
        serieNfse: data.serieNfse ? Number(data.serieNfse) : 1,
        proximoNumeroNfe: data.proximoNumeroNfe
          ? Number(data.proximoNumeroNfe)
          : 1,
        proximoNumeroNfse: data.proximoNumeroNfse
          ? Number(data.proximoNumeroNfse)
          : 1,
        proximoNumeroRps: data.proximoNumeroRps
          ? Number(data.proximoNumeroRps)
          : 1,
        codigoMunicipioIbge: data.codigoMunicipioIbge,
        codigoMunicipioNfse: data.codigoMunicipioNfse,
        provedorNfse: data.provedorNfse,
        webserviceUf: data.webserviceUf,
        environment: data.environment || 'HOMOLOGATION',
        certificateStorageProvider: data.certificateStorageProvider,
        certificateFileUrl: data.certificateFileUrl,
        certificateLastSyncAt: data.certificateLastSyncAt
          ? new Date(data.certificateLastSyncAt)
          : undefined,
        certificateExpiresAt: data.certificateExpiresAt
          ? new Date(data.certificateExpiresAt)
          : undefined,
        certificateSerialNumber: data.certificateSerialNumber,
        securitySecretId,
      },
    });
  }

  async listInvoices(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: {
        contact: true,
        proposal: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
        items: true,
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInvoice(tenantId: string, id: string) {
    return this.prisma.invoice.findFirst({
      where: { tenantId, id },
      include: {
        contact: true,
        proposal: true,
        items: {
          include: {
            product: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getProposalReadiness(tenantId: string, proposalId: string) {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, tenantId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        contact: {
          include: {
            pjDetails: true,
            pfDetails: true,
            addresses: true,
          },
        },
        seller: true,
      },
    });

    if (!proposal) {
      throw new BadRequestException('Orcamento nao encontrado.');
    }

    const config = await this.getConfig(tenantId);
    return this.evaluateProposalReadinessFromData(config, proposal);
  }

  async transmitProposalInvoices(
    tenantId: string,
    proposalId: string,
    options?: { issueProducts?: boolean; issueServices?: boolean },
  ) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        proposalId,
        status: 'READY',
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const results: any[] = [];

    for (const invoice of invoices) {
      if (invoice.scope === 'PRODUCTS' && options?.issueProducts === false) {
        continue;
      }

      if (invoice.scope === 'SERVICES' && options?.issueServices === false) {
        continue;
      }

      try {
        const transmitting = await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'TRANSMITTING',
            events: {
              create: {
                type: 'TRANSMISSION',
                status: 'TRANSMITTING',
                payload: {
                  documentModel: invoice.documentModel,
                  scope: invoice.scope,
                },
              },
            },
          },
        });

        let authorized;
        if (transmitting.documentModel === 'NFE') {
          authorized = await this.nfeGatewayService.authorizeInvoice(
            tenantId,
            transmitting.id,
          );
        } else if (transmitting.documentModel === 'NFSE') {
          authorized = await this.bhNfseGatewayService.authorizeInvoice(
            tenantId,
            transmitting.id,
          );
        } else {
          throw new Error('Modelo fiscal nao suportado para transmissao.');
        }

        results.push({
          invoiceId: authorized.id,
          documentModel: authorized.documentModel,
          scope: authorized.scope,
          status: authorized.status,
        });
      } catch (error: any) {
        const rejected = await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'REJECTED',
            rejectionMessage: error.message,
            events: {
              create: {
                type: 'TRANSMISSION',
                status: 'REJECTED',
                externalMessage: error.message,
              },
            },
          },
        });

        results.push({
          invoiceId: rejected.id,
          documentModel: rejected.documentModel,
          scope: rejected.scope,
          status: rejected.status,
          error: error.message,
        });
      }
    }

    const finalInvoices = await this.prisma.invoice.findMany({
      where: { tenantId, proposalId },
    });

    const allAuthorized =
      finalInvoices.length > 0 &&
      finalInvoices.every((invoice) => invoice.status === 'AUTHORIZED');
    const anyAuthorized = finalInvoices.some(
      (invoice) => invoice.status === 'AUTHORIZED',
    );
    const anyRejected = finalInvoices.some(
      (invoice) => invoice.status === 'REJECTED',
    );

    if (allAuthorized) {
      await this.prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'INVOICED' },
      });
    } else if (anyAuthorized || anyRejected) {
      await this.prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'APPROVED' },
      });
    }

    return {
      invoices: results,
      proposalStatus: allAuthorized ? 'INVOICED' : 'APPROVED',
      transmissionMode: allAuthorized
        ? 'AUTHORIZED'
        : anyAuthorized
          ? 'PARTIAL'
          : 'REJECTED',
    };
  }

  async transmitInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new BadRequestException('Documento fiscal nao encontrado.');
    }

    if (!['READY', 'REJECTED', 'DRAFT'].includes(invoice.status)) {
      throw new BadRequestException(
        'Somente documentos prontos, em rascunho ou rejeitados podem ser retransmitidos.',
      );
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'TRANSMITTING',
        rejectionCode: null,
        rejectionMessage: null,
        events: {
          create: {
            type: 'TRANSMISSION',
            status: 'TRANSMITTING',
            payload: {
              manual: true,
              documentModel: invoice.documentModel,
              scope: invoice.scope,
            },
          },
        },
      },
    });

    try {
      const transmitted =
        invoice.documentModel === 'NFE'
          ? await this.nfeGatewayService.authorizeInvoice(tenantId, invoice.id)
          : invoice.documentModel === 'NFSE'
            ? await this.bhNfseGatewayService.authorizeInvoice(
                tenantId,
                invoice.id,
              )
            : null;

      if (!transmitted) {
        throw new Error('Modelo fiscal nao suportado para transmissao.');
      }

      if (invoice.proposalId) {
        await this.refreshProposalStatusFromInvoices(tenantId, invoice.proposalId);
      }

      return transmitted;
    } catch (error: any) {
      const rejected = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'REJECTED',
          rejectionMessage: error.message,
          events: {
            create: {
              type: 'TRANSMISSION',
              status: 'REJECTED',
              externalMessage: error.message,
              payload: {
                manual: true,
              },
            },
          },
        },
      });

      if (invoice.proposalId) {
        await this.refreshProposalStatusFromInvoices(tenantId, invoice.proposalId);
      }

      return rejected;
    }
  }

  evaluateProposalReadinessFromData(config: any, proposal: any) {
    const issues: Array<{
      scope: 'GLOBAL' | 'NFE' | 'NFSE';
      field: string;
      message: string;
    }> = [];

    const hasProducts = proposal.items.some(
      (item: any) => item.product?.type !== 'SERVICE',
    );
    const hasServices = proposal.items.some(
      (item: any) => item.product?.type === 'SERVICE',
    );

    if (!proposal.contact) {
      issues.push({
        scope: 'GLOBAL',
        field: 'contactId',
        message: 'O orcamento precisa de um cliente/tomador.',
      });
    }

    if (!config.razaoSocialEmitente) {
      issues.push({
        scope: 'GLOBAL',
        field: 'razaoSocialEmitente',
        message: 'Razao social do emitente nao configurada.',
      });
    }

    if (!config.cnpjEmitente) {
      issues.push({
        scope: 'GLOBAL',
        field: 'cnpjEmitente',
        message: 'CNPJ do emitente nao configurado.',
      });
    }

    if (!config.environment) {
      issues.push({
        scope: 'GLOBAL',
        field: 'environment',
        message: 'Ambiente fiscal nao configurado.',
      });
    }

    if (!config.securitySecretId && !config.certificatePfx && !config.certificateFileUrl) {
      issues.push({
        scope: 'GLOBAL',
        field: 'certificate',
        message: 'Certificado fiscal A1 nao configurado.',
      });
    }

    if (hasProducts) {
      if (!config.serieNfe) {
        issues.push({
          scope: 'NFE',
          field: 'serieNfe',
          message: 'Serie de NF-e nao configurada.',
        });
      }

      if (!config.webserviceUf) {
        issues.push({
          scope: 'NFE',
          field: 'webserviceUf',
          message: 'UF/webservice da NF-e nao configurado.',
        });
      }

      if (!proposal.contact?.document) {
        issues.push({
          scope: 'NFE',
          field: 'contact.document',
          message: 'Destinatario da NF-e sem CPF/CNPJ.',
        });
      }

      for (const item of proposal.items.filter((entry: any) => entry.product?.type !== 'SERVICE')) {
        if (!item.product?.ncm) {
          issues.push({
            scope: 'NFE',
            field: `item:${item.productId}:ncm`,
            message: `Produto ${item.product?.name || item.productId} sem NCM.`,
          });
        }

        if (!item.product?.unit) {
          issues.push({
            scope: 'NFE',
            field: `item:${item.productId}:unit`,
            message: `Produto ${item.product?.name || item.productId} sem unidade.`,
          });
        }
      }
    }

    if (hasServices) {
      if (!config.imEmitente) {
        issues.push({
          scope: 'NFSE',
          field: 'imEmitente',
          message: 'Inscricao municipal do prestador nao configurada.',
        });
      }

      if (!config.codigoMunicipioIbge) {
        issues.push({
          scope: 'NFSE',
          field: 'codigoMunicipioIbge',
          message: 'Codigo IBGE do municipio nao configurado.',
        });
      }

      if (!config.provedorNfse) {
        issues.push({
          scope: 'NFSE',
          field: 'provedorNfse',
          message: 'Provedor de NFS-e nao configurado.',
        });
      }

      for (const item of proposal.items.filter((entry: any) => entry.product?.type === 'SERVICE')) {
        if (!item.product?.serviceCode && !item.product?.serviceCodeMunicipal) {
          issues.push({
            scope: 'NFSE',
            field: `item:${item.productId}:serviceCode`,
            message: `Servico ${item.product?.name || item.productId} sem codigo de servico.`,
          });
        }

        if (!item.product?.issRate) {
          issues.push({
            scope: 'NFSE',
            field: `item:${item.productId}:issRate`,
            message: `Servico ${item.product?.name || item.productId} sem aliquota de ISS.`,
          });
        }
      }
    }

    const nfeIssues = issues.filter((issue) => issue.scope === 'GLOBAL' || issue.scope === 'NFE');
    const nfseIssues = issues.filter((issue) => issue.scope === 'GLOBAL' || issue.scope === 'NFSE');

    return {
      hasProducts,
      hasServices,
      canIssueNfe: hasProducts && nfeIssues.length === 0,
      canIssueNfse: hasServices && nfseIssues.length === 0,
      issues,
      nfeIssues,
      nfseIssues,
    };
  }

  async processXml(tenantId: string, xmlContent: string) {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseTagValue: false,
      });
      const jsonObj = parser.parse(xmlContent);

      const nfeProc = jsonObj.nfeProc || jsonObj.NFeProc;
      const nfe = nfeProc?.NFe || jsonObj.NFe;

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
        let cnpj = normalizeDigits(emit.CNPJ || '');
        if (emit.CNPJ) {
          cnpj = cnpj.padStart(14, '0');
          if (!isValidCnpj(cnpj)) {
            throw new BadRequestException(
              `O CNPJ do fornecedor no XML e invalido (${cnpj}).`,
            );
          }
        }

        const razaoSocial = emit.xNome;
        const email = emit.email || '';
        const phone = emit.enderEmit?.fone || '';

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
              email,
              phone,
              category: 'Fornecedor',
              personType: 'PJ',
              pjDetails: {
                create: {
                  cnpj,
                  companyName: razaoSocial,
                  stateRegistration: emit.IE ? String(emit.IE) : null,
                },
              },
            },
          });
        } else {
          const updates: any = {};
          if (!contact.email && email) updates.email = email;
          if (!contact.phone && phone) updates.phone = phone;

          if (Object.keys(updates).length > 0) {
            await tx.contact.update({
              where: { id: contact.id },
              data: updates,
            });
          }
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
            xmlAuthorized: xmlContent,
            documentModel: 'NFE',
            direction: 'INPUT',
            scope: 'FULL',
            issueDate: new Date(),
            type: 'INPUT',
            status: 'AUTHORIZED',
            financialId: financialRecord.id,
            items: {
              create: items.map((item: any) => ({
                description: item.prod?.xProd || 'Item importado',
                quantity: parseInt(item.prod?.qCom || '0', 10) || 0,
                unit: item.prod?.uCom || 'UN',
                unitPrice: parseFloat(item.prod?.vUnCom || 0),
                grossAmount: parseFloat(item.prod?.vProd || 0),
                netAmount: parseFloat(item.prod?.vProd || 0),
                ncm: item.prod?.NCM ? String(item.prod.NCM) : null,
                cest: item.prod?.CEST ? String(item.prod.CEST) : null,
              })),
            },
            events: {
              create: {
                type: 'IMPORT',
                status: 'AUTHORIZED',
                payload: {
                  accessKey,
                  number: numNFE,
                },
              },
            },
          },
        });

        return {
          success: true,
          message: `XML da NF-e ${numNFE} importado com sucesso! Fornecedor e ${items.length} produtos atualizados no estoque.`,
        };
      });
    } catch (error: any) {
      throw new BadRequestException('Falha no processamento: ' + error.message);
    }
  }

  private async refreshProposalStatusFromInvoices(
    tenantId: string,
    proposalId: string,
  ) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, proposalId },
    });

    if (invoices.length === 0) {
      return;
    }

    const allAuthorized = invoices.every(
      (invoice) => invoice.status === 'AUTHORIZED',
    );

    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: allAuthorized ? 'INVOICED' : 'APPROVED',
      },
    });
  }
}
