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
    async getRelationTypes(tenantId) {
        return this.prisma.relationType.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });
    }
    async createRelationType(tenantId, data) {
        return this.prisma.relationType.create({
            data: Object.assign(Object.assign({}, data), { tenantId }),
        });
    }
    async getContactRelations(contactId) {
        const fromRelations = await this.prisma.contactRelation.findMany({
            where: { fromContactId: contactId },
            include: {
                toContact: { select: { id: true, name: true, personType: true } },
                relationType: true,
            },
        });
        const toRelations = await this.prisma.contactRelation.findMany({
            where: { toContactId: contactId },
            include: {
                fromContact: { select: { id: true, name: true, personType: true } },
                relationType: true,
            },
        });
        const formattedFrom = fromRelations.map(r => ({
            id: r.id,
            relatedContact: r.toContact,
            type: r.relationType.name,
            isInverse: false,
        }));
        const formattedTo = toRelations.map(r => ({
            id: r.id,
            relatedContact: r.fromContact,
            type: r.relationType.isBilateral
                ? r.relationType.name
                : (r.relationType.reverseName || r.relationType.name + ' (Inverso)'),
            isInverse: true,
        }));
        return [...formattedFrom, ...formattedTo];
    }
    async createContactRelation(tenantId, fromContactId, data) {
        return this.prisma.contactRelation.create({
            data: {
                tenantId,
                fromContactId,
                toContactId: data.toContactId,
                relationTypeId: data.relationTypeId,
            },
        });
    }
    async removeContactRelation(tenantId, relationId) {
        const relation = await this.prisma.contactRelation.findUnique({ where: { id: relationId } });
        if (!relation || relation.tenantId !== tenantId) {
            throw new Error('Relation not found or access denied');
        }
        return this.prisma.contactRelation.delete({
            where: { id: relationId },
        });
    }
    async getAssetTypes(tenantId) {
        return this.prisma.assetType.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });
    }
    async createAssetType(tenantId, data) {
        return this.prisma.assetType.create({
            data: Object.assign(Object.assign({}, data), { tenantId }),
        });
    }
    async getContactAssets(contactId) {
        return this.prisma.contactAsset.findMany({
            where: { contactId },
            include: {
                assetType: true,
            },
            orderBy: { acquisitionDate: 'desc' },
        });
    }
    async createContactAsset(tenantId, contactId, data) {
        return this.prisma.contactAsset.create({
            data: Object.assign(Object.assign({}, data), { contactId,
                tenantId }),
        });
    }
    async updateContactAsset(tenantId, assetId, data) {
        const asset = await this.prisma.contactAsset.findUnique({ where: { id: assetId } });
        if (!asset || asset.tenantId !== tenantId) {
            throw new Error('Asset not found or access denied');
        }
        return this.prisma.contactAsset.update({
            where: { id: assetId },
            data,
        });
    }
    async removeContactAsset(tenantId, assetId) {
        const asset = await this.prisma.contactAsset.findUnique({ where: { id: assetId } });
        if (!asset || asset.tenantId !== tenantId) {
            throw new Error('Asset not found or access denied');
        }
        return this.prisma.contactAsset.delete({
            where: { id: assetId },
        });
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof database_1.PrismaService !== "undefined" && database_1.PrismaService) === "function" ? _a : Object])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map