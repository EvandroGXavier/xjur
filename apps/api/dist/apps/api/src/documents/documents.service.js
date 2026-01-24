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
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("../../../../packages/database/src/index.ts");
let DocumentsService = class DocumentsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(createDocumentDto) {
        return this.prisma.documentHistory.create({
            data: {
                title: createDocumentDto.title,
                content: createDocumentDto.content,
                templateId: createDocumentDto.templateId,
                snapshot: createDocumentDto.snapshot,
                status: createDocumentDto.status,
            },
        });
    }
    findAll() {
        return this.prisma.documentHistory.findMany({
            orderBy: { updatedAt: 'desc' },
            include: { template: true },
        });
    }
    async findOne(id) {
        const document = await this.prisma.documentHistory.findUnique({
            where: { id },
        });
        if (!document)
            throw new common_1.NotFoundException('Document not found');
        return document;
    }
    update(id, updateDocumentDto) {
        return this.prisma.documentHistory.update({
            where: { id },
            data: updateDocumentDto,
        });
    }
    remove(id) {
        return this.prisma.documentHistory.delete({
            where: { id },
        });
    }
    async getSettings() {
        return this.prisma.documentSettings.findMany();
    }
    async updateSetting(key, value) {
        return this.prisma.documentSettings.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_1.PrismaService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map