"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("../../../../packages/database/src/index.ts");
let ContactsService = class ContactsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(createContactDto) {
        return this.prisma.contact.create({
            data: createContactDto,
        });
    }
    findAll() {
        return this.prisma.contact.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    findOne(id) {
        return this.prisma.contact.findUnique({
            where: { id },
            include: {
                addresses: true,
                additionalContacts: true,
            },
        });
    }
    update(id, updateContactDto) {
        return this.prisma.contact.update({
            where: { id },
            data: updateContactDto,
        });
    }
    remove(id) {
        return this.prisma.contact.delete({
            where: { id },
        });
    }
    addAddress(contactId, createAddressDto) {
        return this.prisma.address.create({
            data: Object.assign(Object.assign({}, createAddressDto), { contactId }),
        });
    }
    updateAddress(contactId, addressId, updateAddressDto) {
        return this.prisma.address.update({
            where: {
                id: addressId,
                contactId,
            },
            data: updateAddressDto,
        });
    }
    removeAddress(contactId, addressId) {
        return this.prisma.address.delete({
            where: {
                id: addressId,
                contactId,
            },
        });
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map