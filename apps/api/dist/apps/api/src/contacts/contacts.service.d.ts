import { PrismaService } from '@dr-x/database';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
export declare class ContactsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createContactDto: CreateContactDto): import(".prisma/client").Prisma.Prisma__ContactClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        document: string | null;
        whatsapp: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        document: string | null;
        whatsapp: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
    }[]>;
    findOne(id: string): import(".prisma/client").Prisma.Prisma__ContactClient<{
        addresses: {
            number: string;
            id: string;
            contactId: string;
            street: string;
            city: string;
            state: string;
            zipCode: string;
        }[];
        additionalContacts: {
            id: string;
            contactId: string;
            value: string;
            type: string;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        document: string | null;
        whatsapp: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
    }, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateContactDto: UpdateContactDto): import(".prisma/client").Prisma.Prisma__ContactClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        document: string | null;
        whatsapp: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__ContactClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        document: string | null;
        whatsapp: string | null;
        email: string | null;
        phone: string | null;
        notes: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    addAddress(contactId: string, createAddressDto: CreateAddressDto): import(".prisma/client").Prisma.Prisma__AddressClient<{
        number: string;
        id: string;
        contactId: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    updateAddress(contactId: string, addressId: string, updateAddressDto: UpdateAddressDto): import(".prisma/client").Prisma.Prisma__AddressClient<{
        number: string;
        id: string;
        contactId: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    removeAddress(contactId: string, addressId: string): import(".prisma/client").Prisma.Prisma__AddressClient<{
        number: string;
        id: string;
        contactId: string;
        street: string;
        city: string;
        state: string;
        zipCode: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
