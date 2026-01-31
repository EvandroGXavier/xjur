import { PrismaService } from '@dr-x/database';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAdditionalContactDto } from './dto/create-additional-contact.dto';
import { UpdateAdditionalContactDto } from './dto/update-additional-contact.dto';
export declare class ContactsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createContactDto: CreateContactDto, tenantId: string): Promise<any>;
    findAll(tenantId: string): any;
    findOne(id: string): any;
    update(id: string, updateContactDto: UpdateContactDto): any;
    remove(id: string): any;
    addAddress(contactId: string, createAddressDto: CreateAddressDto): any;
    updateAddress(contactId: string, addressId: string, updateAddressDto: UpdateAddressDto): any;
    removeAddress(contactId: string, addressId: string): any;
    addAdditionalContact(contactId: string, createAdditionalContactDto: CreateAdditionalContactDto): any;
    updateAdditionalContact(contactId: string, additionalContactId: string, updateAdditionalContactDto: UpdateAdditionalContactDto): any;
    removeAdditionalContact(contactId: string, additionalContactId: string): any;
}
