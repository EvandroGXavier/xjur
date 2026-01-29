"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@drx/database");
const templates_module_1 = require("./templates/templates.module");
const documents_module_1 = require("./documents/documents.module");
const whatsapp_module_1 = require("./whatsapp/whatsapp.module");
const contacts_module_1 = require("./contacts/contacts.module");
const auth_module_1 = require("./auth/auth.module");
const saas_module_1 = require("./saas/saas.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_1.PrismaModule,
            auth_module_1.AuthModule,
            saas_module_1.SaasModule,
            templates_module_1.TemplatesModule,
            documents_module_1.DocumentsModule,
            whatsapp_module_1.WhatsappModule,
            contacts_module_1.ContactsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map