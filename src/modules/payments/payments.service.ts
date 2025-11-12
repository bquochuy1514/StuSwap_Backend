import { BadRequestException, Injectable } from '@nestjs/common';
import { PayosService } from './payos/payos.service';
import { CreatePaymentDto, PaymentPurpose } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly payosService: PayosService) {}

  private async handlePromotionPayment(dto: CreatePaymentDto, user: any) {
    return this.payosService.createPromotePaymentLink(dto, user);
  }

  private async handleRenewPayment(dto: CreatePaymentDto, user: any) {
    return this.payosService.createRenewPaymentLink(dto, user);
  }

  private async handleUpgradePayment(dto: CreatePaymentDto, user: any) {
    // ⚙️ sẽ viết sau — logic nâng cấp tài khoản Premium
    throw new BadRequestException(
      'Chức năng nâng cấp tài khoản chưa được triển khai.',
    );
  }

  handleCreatePayOsPaymentLink(createPaymentDto: CreatePaymentDto, user: any) {
    switch (createPaymentDto.paymentPurpose as PaymentPurpose) {
      case PaymentPurpose.PROMOTE_PRODUCT:
        return this.handlePromotionPayment(createPaymentDto, user);

      case PaymentPurpose.RENEW_PRODUCT:
        return this.handleRenewPayment(createPaymentDto, user);

      case PaymentPurpose.UPGRADE_ACCOUNT:
        return this.handleUpgradePayment(createPaymentDto, user);

      default:
        throw new BadRequestException('Mục đích thanh toán không hợp lệ');
    }
  }

  handlePayOsWebhook(payload: any) {
    return this.payosService.handleWebhook(payload);
  }
}
