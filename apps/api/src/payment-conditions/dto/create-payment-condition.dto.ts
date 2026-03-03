export class CreatePaymentConditionInstallmentDto {
  installment: number;
  days: number;
  percentage: number;
}

export class CreatePaymentConditionDto {
  name: string;
  surcharge?: number;
  discount?: number;
  active?: boolean;
  installments?: CreatePaymentConditionInstallmentDto[];
}
