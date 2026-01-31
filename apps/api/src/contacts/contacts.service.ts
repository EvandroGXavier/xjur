import { Injectable } from '@nestjs/common';
import { PrismaService } from '@dr-x/database';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createContactDto: CreateContactDto, tenantId: string) {
    try {
      console.log('Creating contact:', { ...createContactDto, tenantId });
      return await this.prisma.contact.create({
        data: {
          ...createContactDto,
          tenantId,
        },
      });
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  findAll(tenantId: string) {
    return this.prisma.contact.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.contact.findUnique({
      where: { id },
      include: {
        addresses: true,
        additionalContacts: true,
      },
    });
  }

  update(id: string, updateContactDto: UpdateContactDto) {
    return this.prisma.contact.update({
      where: { id },
      data: updateContactDto,
    });
  }

  remove(id: string) {
    return this.prisma.contact.delete({
      where: { id },
    });
  }

  // Address management methods
  addAddress(contactId: string, createAddressDto: CreateAddressDto) {
    return this.prisma.address.create({
      data: {
        ...createAddressDto,
        contactId,
      },
    });
  }

  updateAddress(contactId: string, addressId: string, updateAddressDto: UpdateAddressDto) {
    return this.prisma.address.update({
      where: { 
        id: addressId,
        contactId, // Ensure the address belongs to the contact
      },
      data: updateAddressDto,
    });
  }

  removeAddress(contactId: string, addressId: string) {
    return this.prisma.address.delete({
      where: { 
        id: addressId,
        contactId, // Ensure the address belongs to the contact
      },
    });
  }
}

