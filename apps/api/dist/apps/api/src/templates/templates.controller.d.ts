import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
export declare class TemplatesController {
    private readonly templatesService;
    constructor(templatesService: TemplatesService);
    create(createTemplateDto: CreateTemplateDto): import(".prisma/client").Prisma.Prisma__DocumentTemplateClient<{
        title: string;
        content: string;
        categoryId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll(categoryId?: string): import(".prisma/client").Prisma.PrismaPromise<({
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            parentId: string | null;
        };
    } & {
        title: string;
        content: string;
        categoryId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findOne(id: string): Promise<{
        category: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            parentId: string | null;
        };
    } & {
        title: string;
        content: string;
        categoryId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, updateTemplateDto: UpdateTemplateDto): import(".prisma/client").Prisma.Prisma__DocumentTemplateClient<{
        title: string;
        content: string;
        categoryId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    remove(id: string): import(".prisma/client").Prisma.Prisma__DocumentTemplateClient<{
        title: string;
        content: string;
        categoryId: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    render(id: string, contactId: string): Promise<{
        content: string;
    }>;
}
