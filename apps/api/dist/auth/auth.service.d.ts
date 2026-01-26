import { PrismaService } from '@drx/database';
export declare class AuthService {
    private prisma;
    constructor(prisma: PrismaService);
    validateUser(email: string, pass: string): Promise<any>;
}
