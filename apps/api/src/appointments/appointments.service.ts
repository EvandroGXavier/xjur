
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAppointmentDto: CreateAppointmentDto, tenantId: string) {
    const { participants, processId, ...data } = createAppointmentDto;

    return this.prisma.appointment.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        status: data.status || 'SCHEDULED',
        process: processId ? { connect: { id: processId } } : undefined,
        participants: participants
          ? {
              create: participants,
            }
          : undefined,
      },
      include: {
        participants: {
            include: {
                contact: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        },
        process: {
            select: {
                title: true,
                code: true
            }
        }
      },
    });
  }

  async findAll(tenantId: string, start?: string, end?: string) {
    const where: any = { tenantId };

    if (start && end) {
        where.startAt = {
            gte: new Date(start),
            lte: new Date(end)
        };
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        participants: {
            include: {
                contact: {
                   select: {
                       name: true
                   }
                }
            }
        },
        process: {
            select: {
                title: true,
                code: true
            }
        }
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        participants: {
            include: {
                contact: true
            }
        },
        process: true
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return appointment;
  }

  async update(id: string, updateAppointmentDto: UpdateAppointmentDto, tenantId: string) {
    const { participants, processId, ...data } = updateAppointmentDto;

    // Check if exists
    await this.findOne(id, tenantId);

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        process: processId ? { connect: { id: processId } } : undefined,
        participants: participants ? {
            deleteMany: {}, // Remove all existing participants
            create: participants, // Create new ones
        } : undefined
      },
      include: {
        participants: true,
        process: true
      },
    });
  }

  async remove(id: string, tenantId: string) {
    // Check if exists
    await this.findOne(id, tenantId);

    return this.prisma.appointment.delete({
      where: { id },
    });
  }
}
