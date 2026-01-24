import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
export declare class ContactsController {
    private readonly contactsService;
    constructor(contactsService: ContactsService);
    create(createContactDto: CreateContactDto): any;
    findAll(): any;
    findOne(id: string): any;
    update(id: string, updateContactDto: UpdateContactDto): any;
    remove(id: string): any;
    addAddress(id: string, createAddressDto: CreateAddressDto): any;
    updateAddress(id: string, addressId: string, updateAddressDto: UpdateAddressDto): any;
    removeAddress(id: string, addressId: string): any;
}
