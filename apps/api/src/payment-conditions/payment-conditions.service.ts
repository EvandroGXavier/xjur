import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreatePaymentConditionDto } from "./dto/create-payment-condition.dto";
import { UpdatePaymentConditionDto } from "./dto/update-payment-condition.dto";

@Injectable()
export class PaymentConditionsService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreatePaymentConditionDto, tenantId: string) {
    const { installments, ...data } = createDto;

    const existing = await this.prisma.paymentCondition.findFirst({
      where: { tenantId, name: data.name },
    });

    if (existing) {
      throw new BadRequestException(
        "Já existe uma Condição de Pagamento com este nome.",
      );
    }

    return this.prisma.paymentCondition.create({
      data: {
        ...data,
        tenantId,
        installments:
          installments && installments.length > 0
            ? {
                create: installments,
              }
            : undefined,
      },
      include: {
        installments: true,
      },
    });
  }

  findAll(tenantId: string) {
    return this.prisma.paymentCondition.findMany({
      where: { tenantId },
      include: {
        installments: {
          orderBy: { installment: "asc" },
        },
      },
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string, tenantId: string) {
    const condition = await this.prisma.paymentCondition.findFirst({
      where: { id, tenantId },
      include: {
        installments: {
          orderBy: { installment: "asc" },
        },
      },
    });

    if (!condition) {
      throw new NotFoundException("Payment condition not found");
    }

    return condition;
  }

  async update(
    id: string,
    updateDto: UpdatePaymentConditionDto,
    tenantId: string,
  ) {
    const { installments, ...data } = updateDto;

    // Verify it exists in the tenant
    await this.findOne(id, tenantId);

    // If installments are provided, we replace all existing installments
    if (installments !== undefined) {
      await this.prisma.paymentConditionInstallment.deleteMany({
        where: { paymentConditionId: id },
      });
    }

    return this.prisma.paymentCondition.update({
      where: { id },
      data: {
        ...data,
        installments:
          installments !== undefined
            ? {
                create: installments,
              }
            : undefined,
      },
      include: {
        installments: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    // Verify it exists in the tenant
    await this.findOne(id, tenantId);

    return this.prisma.paymentCondition.delete({
      where: { id },
    });
  }
}
