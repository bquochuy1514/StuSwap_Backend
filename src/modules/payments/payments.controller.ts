import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(private readonly paymentsService: PaymentsService) {}

  // lt --port 8080 --subdomain huydev
  @UseGuards(JwtAuthGuard)
  @Post('/payos/create-link')
  createPaymentLink(@Body() createPaymentDto: CreatePaymentDto, @Req() req) {
    return this.paymentsService.handleCreatePayOsPaymentLink(
      createPaymentDto,
      req.user,
    );
  }

  // PayOS gọi webhook
  @Post('/payos/webhook')
  async payosWebhook(@Body() payload: any) {
    // this.logger.log(`📩 Webhook received: ${JSON.stringify(payload)}`);
    return this.paymentsService.handlePayOsWebhook(payload);
  }
}
