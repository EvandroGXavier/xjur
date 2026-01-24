import { PrismaService } from '@dr-x/database';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
export declare class TemplatesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createTemplateDto: CreateTemplateDto): any;
    findAll(categoryId?: string): any;
    findOne(id: string): Promise<any>;
    update(id: string, updateTemplateDto: UpdateTemplateDto): any;
    remove(id: string): any;
    render(id: string, contactId: string): Promise<{
        content: any;
    }>;
}
