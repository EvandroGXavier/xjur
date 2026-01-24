import { PrismaService } from '@dr-x/database';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
export declare class DocumentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createDocumentDto: CreateDocumentDto): any;
    findAll(): any;
    findOne(id: string): Promise<any>;
    update(id: string, updateDocumentDto: UpdateDocumentDto): any;
    remove(id: string): any;
    getSettings(): Promise<any>;
    updateSetting(key: string, value: string): Promise<any>;
}
