import { PrismaService } from '@dr-x/database';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
export declare class DocumentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createDocumentDto: CreateDocumentDto): import(".prisma/client").Prisma.Prisma__DocumentHistoryClient<{
        title: string;
        content: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        templateId: string | null;
        snapshot: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        template: {
            title: string;
            content: string;
            categoryId: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        title: string;
        content: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        templateId: string | null;
        snapshot: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
    })[]>;
    findOne(id: string): Promise<{
        title: string;
        content: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        templateId: string | null;
        snapshot: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
    }>;
    update(id: string, updateDocumentDto: UpdateDocumentDto): import(".prisma/client").Prisma.Prisma__DocumentHistoryClient<{
        title: string;
        content: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        templateId: string | null;
        snapshot: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__DocumentHistoryClient<{
        title: string;
        content: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        templateId: string | null;
        snapshot: import("@prisma/client/runtime/library").JsonValue | null;
        status: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    getSettings(): Promise<{
        id: string;
        updatedAt: Date;
        key: string;
        value: string | null;
    }[]>;
    updateSetting(key: string, value: string): Promise<{
        id: string;
        updatedAt: Date;
        key: string;
        value: string | null;
    }>;
}
