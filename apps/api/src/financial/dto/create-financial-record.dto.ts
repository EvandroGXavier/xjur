export class CreateFinancialRecordDto {
  tenantId: string;
  processId?: string;
  bankAccountId?: string;
  description: string;
  amount: number;
  dueDate: string; // ISO date string
  paymentDate?: string; // ISO date string
  status?: 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE';
  type: 'INCOME' | 'EXPENSE';
  category?: string;
  paymentMethod?: 'PIX' | 'BOLETO' | 'TED' | 'DINHEIRO' | 'CARTAO';
  notes?: string;
}
