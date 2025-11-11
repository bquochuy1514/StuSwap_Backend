import { Injectable } from '@nestjs/common';
import { PayosService } from './payos/payos.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly payosService: PayosService) {}

  handleCreatePayOsPaymentLink(createPaymentDto: CreatePaymentDto, user: any) {
    return this.payosService.createPaymentLink(createPaymentDto, user);
  }

  handlePayOsWebhook(payload: any) {
    return this.payosService.handleWebhook(payload);
  }
}
