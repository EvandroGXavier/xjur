import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
export declare class TemplatesController {
    private readonly templatesService;
    constructor(templatesService: TemplatesService);
    create(createTemplateDto: CreateTemplateDto): any;
    findAll(categoryId?: string): any;
    findOne(id: string): Promise<any>;
    update(id: string, updateTemplateDto: UpdateTemplateDto): any;
    remove(id: string): any;
    render(id: string, contactId: string): Promise<{
        content: any;
    }>;
}
