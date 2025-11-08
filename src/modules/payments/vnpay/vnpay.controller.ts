import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { VnpayService } from './vnpay.service';
import { Request } from 'express';

@Controller('payments/vnpay')
export class VnpayController {
  constructor(private readonly vnpayService: VnpayService) {}

  // lt --port 8080 --subdomain huydev

  @Get()
  getBankList() {
    return this.vnpayService.getBankList();
  }

  /** Tạo đường dẫn thanh toán VNPay */
  @Post('create')
  createPayment(
    @Body() body: { amount: number; orderInfo?: string },
    @Req() req: Request,
  ) {
    return this.vnpayService.createPayment(body, req);
  }

  @Get('callback')
  async handleVnpayReturn(@Req() req) {
    const query = req.query;
    console.log('VNPay callback:', query);

    // Xác thực chữ ký
    const isValid = await this.vnpayService.verifyReturnUrl(query);

    if (!isValid) {
      console.warn('❌ VNPay callback signature invalid!');
      return { success: false, message: 'Invalid signature' };
    }
    console.log('VNPay callback signature valid!');

    // Kiểm tra mã phản hồi giao dịch
    if (query['vnp_ResponseCode'] === '00') {
      // Thành công
      return { success: true, message: 'Thanh toán thành công', data: query };
    } else {
      // Thất bại
      return { success: false, message: 'Thanh toán thất bại', data: query };
    }
  }
}
