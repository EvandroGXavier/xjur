export class CreateDocumentDto {
  title: string;
  content: string;
  tenantId: string;
  templateId?: string;
  processId?: string;
  timelineId?: string;
  snapshot?: any; // JSON object with variable values
  status?: 'DRAFT' | 'FINALIZED';
}
