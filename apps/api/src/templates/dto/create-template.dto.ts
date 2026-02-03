export class CreateTemplateDto {
  title: string;
  content: string;
  tenantId: string;
  categoryId?: string;
  variables?: any;
}
