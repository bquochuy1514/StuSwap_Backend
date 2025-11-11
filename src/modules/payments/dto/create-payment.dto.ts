import { IsNotEmpty, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PromotionType } from 'src/modules/products/enums/product.enum';

export class CreatePaymentDto {
  @Type(() => Number)
  @IsInt({ message: 'ID sản phẩm phải là số nguyên.' })
  @Min(1, { message: 'ID sản phẩm không hợp lệ.' })
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống.' })
  productId: number;

  @IsEnum(PromotionType, { message: 'Loại gói đẩy tin không hợp lệ.' })
  @IsNotEmpty({ message: 'Loại gói đẩy tin không được để trống.' })
  packageType: PromotionType;
}
