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
exports.FinancialService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("../../../../packages/database/dist/index.js");
let FinancialService = class FinancialService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createFee(processId, description, amount, dueDate) {
        return this.prisma.financialRecord.create({
            data: {
                processId,
                description,
                amount,
                dueDate,
                status: 'PENDING',
                type: 'FEE'
            }
        });
    }
    async getProcessBalance(processId) {
        const records = await this.prisma.financialRecord.findMany({
            where: { processId }
        });
        const totalFees = records
            .filter(r => r.type === 'FEE')
            .reduce((sum, r) => sum + Number(r.amount), 0);
        const paid = records
            .filter(r => r.status === 'PAID')
            .reduce((sum, r) => sum + Number(r.amount), 0);
        return {
            totalFees,
            paid,
            outstanding: totalFees - paid
        };
    }
    async calculateEngagementScore(contactId) {
        const logs = await this.prisma.communicationLog.findMany({
            where: { contactId },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        if (logs.length === 0)
            return 0;
        const lastInteraction = logs[0].createdAt;
        const daysSinceLastContact = (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
        let score = 100 - (daysSinceLastContact * 5);
        if (logs[0].direction === 'INBOUND') {
            score += 20;
        }
        return Math.max(0, Math.min(100, score));
    }
};
exports.FinancialService = FinancialService;
exports.FinancialService = FinancialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof database_1.PrismaService !== "undefined" && database_1.PrismaService) === "function" ? _a : Object])
], FinancialService);
//# sourceMappingURL=financial.service.js.map