
export class CreateTicketDto {
  title: string;
  description?: string; // Optional initial message
  contactId?: string;   // Existing contact
  contactPhone?: string; // Or dynamic creation
  contactName?: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'WEBCHAT';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  queue?: 'FINANCEIRO' | 'JURIDICO' | 'COMERCIAL' | 'SUPORTE';
  assigneeId?: string;
}
