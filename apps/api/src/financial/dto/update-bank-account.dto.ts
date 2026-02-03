export class UpdateBankAccountDto {
  bankName?: string;
  accountType?: 'CHECKING' | 'SAVINGS';
  accountNumber?: string;
  agency?: string;
  balance?: number;
  isActive?: boolean;
  notes?: string;
}
