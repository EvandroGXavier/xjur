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
exports.TriagemService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("../../../../packages/database/dist/index.js");
let TriagemService = class TriagemService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleIncomingMessage(phone, content, mediaUrl) {
        let contact = await this.prisma.contact.findFirst({ where: { whatsapp: phone } });
        if (!contact) {
            return {
                action: 'AI_HANDOFF',
                context: 'NEW_LEAD',
                reply: 'Olá, aqui é o Dr.X, inteligência jurídica. Não localizei seu contato. Para iniciarmos, poderia enviar seu CPF ou informar o número do processo?'
            };
        }
        const log = await this.prisma.communicationLog.create({
            data: {
                contactId: contact.id,
                direction: 'INBOUND',
                channel: 'WHATSAPP',
                content,
                mediaUrl,
                status: 'RECEIVED',
            },
        });
        const lastInteraction = await this.prisma.communicationLog.findFirst({
            where: { contactId: contact.id, id: { not: log.id } },
            orderBy: { createdAt: 'desc' }
        });
        let aiContext = "Saudação Padrão";
        if (lastInteraction) {
            aiContext = `Cliente retornando. Último assunto: ${lastInteraction.content}`;
        }
        return {
            action: 'NOTIFY_AGENT',
            logId: log.id,
            contact: contact.name,
            suggestion: aiContext
        };
    }
    async linkToProcess(messageId, processId) {
        const log = await this.prisma.communicationLog.findUnique({ where: { id: messageId } });
        if (!log)
            throw new Error('Message not found');
        const timelineEntry = await this.prisma.processTimeline.create({
            data: {
                processId,
                title: log.mediaUrl ? 'Nova Prova (Midia)' : 'Mensagem do Cliente',
                description: log.content,
                date: new Date(),
                type: log.mediaUrl ? 'FILE' : 'MESSAGE',
                metadata: {
                    originalLogId: log.id,
                    source: 'Dr.X Triagem',
                    mediaUrl: log.mediaUrl
                }
            }
        });
        await this.prisma.communicationLog.update({
            where: { id: messageId },
            data: { status: 'TRIAGED' }
        });
        return timelineEntry;
    }
};
exports.TriagemService = TriagemService;
exports.TriagemService = TriagemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof database_1.PrismaService !== "undefined" && database_1.PrismaService) === "function" ? _a : Object])
], TriagemService);
//# sourceMappingURL=triagem.service.js.map