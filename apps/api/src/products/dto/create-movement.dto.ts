
export class CreateMovementDto {
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  reason?: string;
  unitPrice?: number;
}
