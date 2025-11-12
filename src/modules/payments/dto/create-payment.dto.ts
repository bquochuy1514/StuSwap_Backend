import { IsNotEmpty, IsEnum, IsInt, Min, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PromotionType } from 'src/modules/products/enums/product.enum';

export enum PaymentPurpose {
  RENEW_PRODUCT = 'RENEW_PRODUCT', // Gia hạn tin
  PROMOTE_PRODUCT = 'PROMOTE_PRODUCT', // Boost / Priority
  UPGRADE_ACCOUNT = 'UPGRADE_ACCOUNT', // Nâng cấp Premium
}

export class CreatePaymentDto {
  // o (object) là instance của class đó - toàn bộ dữ liệu mà client gửi lên
  @ValidateIf(
    (o) =>
      o.paymentPurpose === PaymentPurpose.RENEW_PRODUCT ||
      o.paymentPurpose === PaymentPurpose.PROMOTE_PRODUCT,
  )
  @Type(() => Number)
  @IsInt({ message: 'ID sản phẩm phải là số nguyên.' })
  @Min(1, { message: 'ID sản phẩm không hợp lệ.' })
  @IsNotEmpty({ message: 'ID sản phẩm không được để trống.' })
  productId: number;

  @ValidateIf((o) => o.paymentPurpose === PaymentPurpose.PROMOTE_PRODUCT)
  @IsEnum(PromotionType, { message: 'Loại gói đẩy tin không hợp lệ.' })
  @IsNotEmpty({ message: 'Loại gói đẩy tin không được để trống.' })
  packageType: PromotionType;

  @Transform(({ value }) => value.toUpperCase())
  @IsEnum(PaymentPurpose, {
    message: 'Mục đích thanh toán không hợp lệ.',
  })
  @IsNotEmpty({ message: 'Mục đích thanh toán không được để trống.' })
  paymentPurpose: PaymentPurpose;
}
