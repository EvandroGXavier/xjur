export declare class CreateDocumentDto {
    title: string;
    content: string;
    templateId?: string;
    snapshot?: any;
    status: 'DRAFT' | 'FINALIZED';
}
