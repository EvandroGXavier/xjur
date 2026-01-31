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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsController = void 0;
const common_1 = require("@nestjs/common");
const contacts_service_1 = require("./contacts.service");
const enrichment_service_1 = require("./enrichment.service");
const create_contact_dto_1 = require("./dto/create-contact.dto");
const update_contact_dto_1 = require("./dto/update-contact.dto");
const create_address_dto_1 = require("./dto/create-address.dto");
const update_address_dto_1 = require("./dto/update-address.dto");
const create_additional_contact_dto_1 = require("./dto/create-additional-contact.dto");
const update_additional_contact_dto_1 = require("./dto/update-additional-contact.dto");
const relation_dto_1 = require("./dto/relation.dto");
const asset_dto_1 = require("./dto/asset.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let ContactsController = class ContactsController {
    constructor(contactsService, enrichmentService) {
        this.contactsService = contactsService;
        this.enrichmentService = enrichmentService;
    }
    create(createContactDto, user) {
        console.log('Controller User:', user);
        if (!user || !user.tenantId) {
            console.error('User or tenantId missing in controller!');
            throw new Error('User context invalid');
        }
        return this.contactsService.create(createContactDto, user.tenantId);
    }
    findAll(user) {
        return this.contactsService.findAll(user.tenantId);
    }
    findOne(id) {
        return this.contactsService.findOne(id);
    }
    update(id, updateContactDto) {
        return this.contactsService.update(id, updateContactDto);
    }
    remove(id) {
        return this.contactsService.remove(id);
    }
    addAddress(id, createAddressDto) {
        return this.contactsService.addAddress(id, createAddressDto);
    }
    updateAddress(id, addressId, updateAddressDto) {
        return this.contactsService.updateAddress(id, addressId, updateAddressDto);
    }
    removeAddress(id, addressId) {
        return this.contactsService.removeAddress(id, addressId);
    }
    addAdditionalContact(id, createAdditionalContactDto) {
        return this.contactsService.addAdditionalContact(id, createAdditionalContactDto);
    }
    updateAdditionalContact(id, contactId, updateAdditionalContactDto) {
        return this.contactsService.updateAdditionalContact(id, contactId, updateAdditionalContactDto);
    }
    removeAdditionalContact(id, contactId) {
        return this.contactsService.removeAdditionalContact(id, contactId);
    }
    getRelationTypes(user) {
        return this.contactsService.getRelationTypes(user.tenantId);
    }
    createRelationType(dto, user) {
        return this.contactsService.createRelationType(user.tenantId, dto);
    }
    getContactRelations(id) {
        return this.contactsService.getContactRelations(id);
    }
    createContactRelation(id, dto, user) {
        return this.contactsService.createContactRelation(user.tenantId, id, dto);
    }
    removeContactRelation(relationId, user) {
        return this.contactsService.removeContactRelation(user.tenantId, relationId);
    }
    getAssetTypes(user) {
        return this.contactsService.getAssetTypes(user.tenantId);
    }
    createAssetType(dto, user) {
        return this.contactsService.createAssetType(user.tenantId, dto);
    }
    getContactAssets(id) {
        return this.contactsService.getContactAssets(id);
    }
    createContactAsset(id, dto, user) {
        return this.contactsService.createContactAsset(user.tenantId, id, dto);
    }
    updateContactAsset(assetId, dto, user) {
        return this.contactsService.updateContactAsset(user.tenantId, assetId, dto);
    }
    removeContactAsset(assetId, user) {
        return this.contactsService.removeContactAsset(user.tenantId, assetId);
    }
    async enrichCNPJ(cnpj) {
        return this.enrichmentService.consultCNPJ(cnpj);
    }
    async enrichCEP(cep) {
        return this.enrichmentService.consultCEP(cep);
    }
};
exports.ContactsController = ContactsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_contact_dto_1.CreateContactDto, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_contact_dto_1.UpdateContactDto]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/addresses'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_address_dto_1.CreateAddressDto]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "addAddress", null);
__decorate([
    (0, common_1.Patch)(':id/addresses/:addressId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('addressId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_address_dto_1.UpdateAddressDto]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "updateAddress", null);
__decorate([
    (0, common_1.Delete)(':id/addresses/:addressId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('addressId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "removeAddress", null);
__decorate([
    (0, common_1.Post)(':id/additional-contacts'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_additional_contact_dto_1.CreateAdditionalContactDto]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "addAdditionalContact", null);
__decorate([
    (0, common_1.Patch)(':id/additional-contacts/:contactId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_additional_contact_dto_1.UpdateAdditionalContactDto]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "updateAdditionalContact", null);
__decorate([
    (0, common_1.Delete)(':id/additional-contacts/:contactId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "removeAdditionalContact", null);
__decorate([
    (0, common_1.Get)('relations/types'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "getRelationTypes", null);
__decorate([
    (0, common_1.Post)('relations/types'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [relation_dto_1.CreateRelationTypeDto, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "createRelationType", null);
__decorate([
    (0, common_1.Get)(':id/relations'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "getContactRelations", null);
__decorate([
    (0, common_1.Post)(':id/relations'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, relation_dto_1.CreateContactRelationDto, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "createContactRelation", null);
__decorate([
    (0, common_1.Delete)(':id/relations/:relationId'),
    __param(0, (0, common_1.Param)('relationId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "removeContactRelation", null);
__decorate([
    (0, common_1.Get)('assets/types'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "getAssetTypes", null);
__decorate([
    (0, common_1.Post)('assets/types'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [asset_dto_1.CreateAssetTypeDto, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "createAssetType", null);
__decorate([
    (0, common_1.Get)(':id/assets'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "getContactAssets", null);
__decorate([
    (0, common_1.Post)(':id/assets'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, asset_dto_1.CreateContactAssetDto, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "createContactAsset", null);
__decorate([
    (0, common_1.Patch)(':id/assets/:assetId'),
    __param(0, (0, common_1.Param)('assetId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, asset_dto_1.UpdateContactAssetDto, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "updateContactAsset", null);
__decorate([
    (0, common_1.Delete)(':id/assets/:assetId'),
    __param(0, (0, common_1.Param)('assetId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ContactsController.prototype, "removeContactAsset", null);
__decorate([
    (0, common_1.Get)('enrich/cnpj'),
    __param(0, (0, common_1.Query)('cnpj')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "enrichCNPJ", null);
__decorate([
    (0, common_1.Get)('enrich/cep'),
    __param(0, (0, common_1.Query)('cep')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "enrichCEP", null);
exports.ContactsController = ContactsController = __decorate([
    (0, common_1.Controller)('contacts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [contacts_service_1.ContactsService,
        enrichment_service_1.EnrichmentService])
], ContactsController);
//# sourceMappingURL=contacts.controller.js.map