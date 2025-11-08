import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { VnpayService as VnpayLibService } from 'nestjs-vnpay';
import { VnpLocale } from 'vnpay';

@Injectable()
export class VnpayService {
  constructor(private readonly vnpayLibService: VnpayLibService) {}

  async getBankList() {
    return await this.vnpayLibService.getBankList();
  }

  async createPayment(
    body: { amount: number; orderInfo?: string },
    req: Request,
  ) {
    const ipAddr = req.ip || req.connection.remoteAddress;

    const url = await this.vnpayLibService.buildPaymentUrl({
      vnp_TxnRef: Date.now().toString(), // mã đơn hàng duy nhất
      vnp_Amount: body.amount * 100, // *100 theo yêu cầu VNPay
      vnp_IpAddr: ipAddr,
      vnp_OrderInfo: body.orderInfo || `Thanh toán đơn hàng ${Date.now()}`,
      vnp_ReturnUrl: process.env.VNP_RETURN_URL,
      vnp_Locale: VnpLocale.VN,
    });

    return { paymentUrl: url };
  }

  async verifyReturnUrl(query) {
    return this.vnpayLibService.verifyReturnUrl(query);
  }
}
