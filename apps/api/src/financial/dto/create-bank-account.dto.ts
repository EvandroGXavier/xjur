export class CreateBankAccountDto {
  tenantId: string;
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS';
  accountNumber?: string;
  agency?: string;
  balance?: number;
  isActive?: boolean;
  notes?: string;
}
