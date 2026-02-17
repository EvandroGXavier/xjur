
import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateConnectionDto, ConnectionType } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ConnectionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService
  ) {}

  onModuleInit() {
    // Reset PAIRING status to DISCONNECTED on startup to ensure clean state
  }

  async findAll(tenantId: string) {
    return this.prisma.connection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const connection = await this.prisma.connection.findUnique({
      where: { id },
    });

    if (!connection || connection.tenantId !== tenantId) {
      throw new NotFoundException(`Connection ${id} not found`);
    }

    return connection;
  }

  async create(createConnectionDto: CreateConnectionDto, tenantId: string) {
    const connection = await this.prisma.connection.create({
      data: {
        ...createConnectionDto,
        tenantId,
        status: 'DISCONNECTED',
        config: createConnectionDto.config || {},
      },
    });

    return connection;
  }

  async update(id: string, updateConnectionDto: UpdateConnectionDto, tenantId: string) {
    await this.findOne(id, tenantId); // Check ownership

    return this.prisma.connection.update({
      where: { id },
      data: {
        ...updateConnectionDto,
        config: updateConnectionDto.config || undefined,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const connection = await this.findOne(id, tenantId);
    
    // If connected, disconnect first
    if (connection.type === ConnectionType.WHATSAPP && connection.status !== 'DISCONNECTED') {
        await this.whatsappService.disconnect(id);
    }

    return this.prisma.connection.delete({ where: { id } });
  }

  // --- Connection Actions ---

  async connect(id: string, tenantId: string) {
    const connection = await this.findOne(id, tenantId);

    if (connection.status === 'CONNECTED') {
       return { status: 'CONNECTED', message: 'Already connected' };
    }

    // WHATSAPP LOGIC (Real Implementation)
    if (connection.type === ConnectionType.WHATSAPP) {
        // Set PAIRING status *before* initiating session to handle race condition with initial QR update
        await this.prisma.connection.update({
            where: { id },
            data: { status: 'PAIRING', qrCode: null } // Reset QR until generated
        });

        // Start Baileys Session
        await this.whatsappService.createSession(id);

        return { status: 'PAIRING', message: 'Initializing WhatsApp...' };
    }

    // INSTAGRAM LOGIC (Simulated)
    if (connection.type === ConnectionType.INSTAGRAM) {
        await this.prisma.connection.update({
            where: { id },
            data: { status: 'CONNECTED' }
        });
        return { status: 'CONNECTED', message: 'Instagram Connected (Simulated)' };
    }

    // EMAIL LOGIC (Simulated)
    if (connection.type === ConnectionType.EMAIL) {
        await this.prisma.connection.update({
            where: { id },
            data: { status: 'CONNECTED' }
        });
        return { status: 'CONNECTED', message: 'Email Connected via IMAP/SMTP' };
    }

    throw new BadRequestException('Unsupported connection type');
  }

  async disconnect(id: string, tenantId: string) {
    const connection = await this.findOne(id, tenantId);
    
    if (connection.type === ConnectionType.WHATSAPP) {
        await this.whatsappService.disconnect(id);
    }
    
    return this.prisma.connection.update({
      where: { id },
      data: { 
          status: 'DISCONNECTED',
          qrCode: null 
      }
    });
  }

  async getStatus(id: string, tenantId: string) {
      const connection = await this.findOne(id, tenantId);
      return { 
          id: connection.id, 
          status: connection.status, 
          qrCode: connection.qrCode,
          updatedAt: connection.updatedAt
      };
  }
}
