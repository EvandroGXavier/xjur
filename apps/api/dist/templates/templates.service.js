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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplatesService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@dr-x/database");
let TemplatesService = class TemplatesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(createTemplateDto) {
        return this.prisma.documentTemplate.create({
            data: {
                title: createTemplateDto.title,
                content: createTemplateDto.content,
                categoryId: createTemplateDto.categoryId,
            },
        });
    }
    findAll(categoryId) {
        return this.prisma.documentTemplate.findMany({
            where: categoryId ? { categoryId } : {},
            include: { category: true },
            orderBy: { title: 'asc' },
        });
    }
    async findOne(id) {
        const template = await this.prisma.documentTemplate.findUnique({
            where: { id },
            include: { category: true },
        });
        if (!template)
            throw new common_1.NotFoundException('Template not found');
        return template;
    }
    update(id, updateTemplateDto) {
        return this.prisma.documentTemplate.update({
            where: { id },
            data: updateTemplateDto,
        });
    }
    remove(id) {
        return this.prisma.documentTemplate.delete({
            where: { id },
        });
    }
    async render(id, contactId) {
        const template = await this.findOne(id);
        const contact = await this.prisma.contact.findUnique({
            where: { id: contactId },
            include: { addresses: true },
        });
        if (!contact) {
            throw new common_1.NotFoundException('Contact not found');
        }
        let content = template.content;
        const replacements = {
            '\\[NOME_CLIENTE\\]': contact.name,
            '\\[DOC_CLIENTE\\]': contact.document || '',
            '\\[EMAIL_CLIENTE\\]': contact.email || '',
            '\\[TELEFONE_CLIENTE\\]': contact.phone || '',
            '\\[ENDERECO_CLIENTE\\]': contact.addresses[0]
                ? `${contact.addresses[0].street}, ${contact.addresses[0].number}, ${contact.addresses[0].city}-${contact.addresses[0].state}`
                : '',
        };
        for (const [key, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(key, 'g'), value);
        }
        return { content };
    }
};
exports.TemplatesService = TemplatesService;
exports.TemplatesService = TemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof database_1.PrismaService !== "undefined" && database_1.PrismaService) === "function" ? _a : Object])
], TemplatesService);
//# sourceMappingURL=templates.service.js.map