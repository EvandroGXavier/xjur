
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@drx/database';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeParticipants(participants?: Array<any>) {
    if (!Array.isArray(participants)) return undefined;

    const normalized = participants
      .map((participant) => ({
        contactId: participant?.contactId || undefined,
        name: participant?.contactId
          ? undefined
          : String(participant?.name || '').trim() || undefined,
        role: String(participant?.role || '').trim(),
        confirmed: Boolean(participant?.confirmed),
      }))
      .filter((participant) => participant.role && (participant.contactId || participant.name));

    return normalized.length > 0 ? normalized : undefined;
  }

  private ensureValidRange(startAt: Date, endAt: Date) {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('As datas do compromisso são inválidas.');
    }

    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('O horário final deve ser maior que o horário inicial.');
    }
  }

  async create(createAppointmentDto: CreateAppointmentDto, tenantId: string) {
    const { participants, processId, ...data } = createAppointmentDto;
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);
    this.ensureValidRange(startAt, endAt);
    const normalizedParticipants = this.normalizeParticipants(participants);

    return this.prisma.appointment.create({
      data: {
        ...data,
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        location: data.location?.trim() || undefined,
        startAt,
        endAt,
        tenant: { connect: { id: tenantId } },
        status: data.status || 'SCHEDULED',
        process: processId ? { connect: { id: processId } } : undefined,
        participants: normalizedParticipants
          ? {
              create: normalizedParticipants,
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

  async findAll(tenantId: string, start?: string, end?: string, processId?: string) {
    const where: any = { tenantId };

    if (start && end) {
        const startAt = new Date(start);
        const endAt = new Date(end);
        this.ensureValidRange(startAt, endAt);
        where.startAt = {
            gte: startAt,
            lte: endAt
        };
    }
    
    if (processId) {
        where.processId = processId;
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

    const updateData: any = {
      ...data,
      title: data.title?.trim(),
      description: data.description?.trim() || undefined,
      location: data.location?.trim() || undefined,
    };

    if (data.startAt || data.endAt) {
      const current = await this.findOne(id, tenantId);
      const startAt = data.startAt ? new Date(data.startAt) : new Date(current.startAt);
      const endAt = data.endAt ? new Date(data.endAt) : new Date(current.endAt);
      this.ensureValidRange(startAt, endAt);
      updateData.startAt = startAt;
      updateData.endAt = endAt;
    }

    const normalizedParticipants = this.normalizeParticipants(participants);

    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...updateData,
        process: processId ? { connect: { id: processId } } : processId === null ? { disconnect: true } : undefined,
        participants: participants ? {
            deleteMany: {}, // Remove all existing participants
            create: normalizedParticipants || [], // Create new ones
        } : undefined
      },
      include: {
        participants: {
          include: {
            contact: true,
          },
        },
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
