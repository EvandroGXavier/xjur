import { ContactsService } from './contacts.service';
import { EnrichmentService } from './enrichment.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAdditionalContactDto } from './dto/create-additional-contact.dto';
import { UpdateAdditionalContactDto } from './dto/update-additional-contact.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
export declare class ContactsController {
    private readonly contactsService;
    private readonly enrichmentService;
    constructor(contactsService: ContactsService, enrichmentService: EnrichmentService);
    create(createContactDto: CreateContactDto, user: CurrentUserData): Promise<any>;
    findAll(user: CurrentUserData): any;
    findOne(id: string): any;
    update(id: string, updateContactDto: UpdateContactDto): any;
    remove(id: string): any;
    addAddress(id: string, createAddressDto: CreateAddressDto): any;
    updateAddress(id: string, addressId: string, updateAddressDto: UpdateAddressDto): any;
    removeAddress(id: string, addressId: string): any;
    addAdditionalContact(id: string, createAdditionalContactDto: CreateAdditionalContactDto): any;
    updateAdditionalContact(id: string, contactId: string, updateAdditionalContactDto: UpdateAdditionalContactDto): any;
    removeAdditionalContact(id: string, contactId: string): any;
    enrichCNPJ(cnpj: string): Promise<import("./enrichment.service").CNPJData>;
    enrichCEP(cep: string): Promise<import("./enrichment.service").CEPData>;
}
