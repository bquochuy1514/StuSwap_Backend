import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  packageId: number; // ID của package muốn mua

  @IsOptional()
  productId?: number; // Chỉ có khi mua gói PROMOTION hoặc RENEW
}
