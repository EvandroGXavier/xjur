
export class CreateProductDto {
  name: string;
  description?: string;
  barcode?: string;
  minStock?: number;
  currentStock?: number;
  costPrice?: number;
  sellPrice?: number;
  supplierId?: string;
}
