import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
export declare class DocumentsController {
    private readonly documentsService;
    constructor(documentsService: DocumentsService);
    create(createDocumentDto: CreateDocumentDto): any;
    findAll(): any;
    getSettings(): Promise<any>;
    updateSetting(key: string, value: string): Promise<any>;
    findOne(id: string): Promise<any>;
    update(id: string, updateDocumentDto: UpdateDocumentDto): any;
    remove(id: string): any;
}
