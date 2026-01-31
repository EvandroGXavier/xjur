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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("../../../../packages/database/dist/index.js");
let ContactsService = class ContactsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createContactDto, tenantId) {
        try {
            console.log('Creating contact:', Object.assign(Object.assign({}, createContactDto), { tenantId }));
            const _a = createContactDto, { addresses } = _a, contactData = __rest(_a, ["addresses"]);
            return await this.prisma.contact.create({
                data: Object.assign(Object.assign({}, contactData), { tenantId }),
            });
        }
        catch (error) {
            console.error('Error creating contact:', error);
            throw error;
        }
    }
    findAll(tenantId) {
        return this.prisma.contact.findMany({
            where: { tenantId },
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
    addAdditionalContact(contactId, createAdditionalContactDto) {
        return this.prisma.additionalContact.create({
            data: Object.assign(Object.assign({}, createAdditionalContactDto), { contactId }),
        });
    }
    updateAdditionalContact(contactId, additionalContactId, updateAdditionalContactDto) {
        return this.prisma.additionalContact.update({
            where: {
                id: additionalContactId,
                contactId,
            },
            data: updateAdditionalContactDto,
        });
    }
    removeAdditionalContact(contactId, additionalContactId) {
        return this.prisma.additionalContact.delete({
            where: {
                id: additionalContactId,
                contactId,
            },
        });
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof database_1.PrismaService !== "undefined" && database_1.PrismaService) === "function" ? _a : Object])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map