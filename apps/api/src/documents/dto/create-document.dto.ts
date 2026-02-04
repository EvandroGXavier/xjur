export class CreateDocumentDto {
  title: string;
  content: string;
<<<<<<< HEAD
  templateId?: string;
  snapshot?: any; // JSON object with variable values
  status: 'DRAFT' | 'FINALIZED';
=======
  tenantId: string;
  templateId?: string;
  snapshot?: any; // JSON object with variable values
  status?: 'DRAFT' | 'FINALIZED';
>>>>>>> f67fa9245bfe51c68d57fe11522543ec186b9f69
}
