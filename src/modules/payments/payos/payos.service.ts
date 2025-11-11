import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node'; // giả sử SDK đúng tên như này
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { Repository } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';
import { PromotionType } from 'src/modules/products/enums/product.enum';
import { UsersService } from 'src/modules/users/users.service';
import * as crypto from 'crypto';

@Injectable()
export class PayosService {
  private readonly payOS: PayOS;
  private readonly logger = new Logger(PayosService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly usersService: UsersService,
  ) {
    this.payOS = new PayOS({
      clientId: this.configService.get<string>('PAYOS_CLIENT_ID'),
      apiKey: this.configService.get<string>('PAYOS_API_KEY'),
      checksumKey: this.configService.get<string>('PAYOS_CHECKSUM_KEY'),
    });
  }

  private sortObjDataByKey(object: Record<string, any>) {
    return Object.keys(object)
      .sort()
      .reduce((obj, key) => {
        obj[key] = object[key];
        return obj;
      }, {});
  }

  private convertObjToQueryStr(object: Record<string, any>) {
    return Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .map((key) => {
        let value = object[key];
        // Nếu là array => sort từng phần tử
        if (value && Array.isArray(value)) {
          value = JSON.stringify(
            value.map((val) => this.sortObjDataByKey(val)),
          );
        }
        // Nếu null/undefined => để chuỗi rỗng
        if ([null, undefined, 'undefined', 'null'].includes(value)) {
          value = '';
        }
        return `${key}=${value}`;
      })
      .join('&');
  }

  private verifyWebhookSignature(data: any, signature: string): boolean {
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY');
    const sortedData = this.sortObjDataByKey(data);
    const queryStr = this.convertObjToQueryStr(sortedData);
    const computedSignature = crypto
      .createHmac('sha256', checksumKey)
      .update(queryStr)
      .digest('hex');
    return computedSignature === signature;
  }

  async createPaymentLink(createPaymentDto: CreatePaymentDto, user: any) {
    const { productId, packageType } = createPaymentDto;

    // 1️⃣ Kiểm tra sản phẩm có tồn tại không
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại.');

    const userDB = await this.usersService.findUserByEmail(user.email);
    if (!userDB) throw new NotFoundException('Người dùng không tồn tại.');

    // 2️⃣ Xác định số tiền dựa theo loại gói
    let amount = 0;
    if (packageType === PromotionType.BOOST) amount = 5000;
    else if (packageType === PromotionType.PRIORITY) amount = 15000;

    // 3️⃣ Tạo orderCode duy nhất (PayOS yêu cầu)
    const orderCode = Math.floor(Date.now() / 1000);

    // 4️⃣ Tạo bản ghi thanh toán (PENDING)
    const payment = this.paymentRepo.create({
      orderId: orderCode.toString(),
      amount,
      packageType,
      status: 'PENDING',
      user: userDB,
      product,
    });
    await this.paymentRepo.save(payment);

    // 5️⃣ Tạo link thanh toán qua PayOS
    const description =
      packageType === PromotionType.BOOST
        ? `Boost sản phẩm #${product.id}`
        : `Priority sản phẩm #${product.id}`;
    const returnUrl = `${process.env.FRONTEND_URL}/payment/result?orderId=${payment.id}&product_id=${productId}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/payment/result?orderId=${payment.id}&product_id=${productId}`;

    const response = await this.payOS.paymentRequests.create({
      orderCode,
      amount,
      description,
      returnUrl,
      cancelUrl,
    });

    // 6️⃣ Cập nhật lại link thanh toán vào DB
    payment.checkoutUrl = response.checkoutUrl;
    await this.paymentRepo.save(payment);

    // 7️⃣ Trả kết quả về FE
    return {
      paymentId: payment.id,
      orderCode,
      checkoutUrl: response.checkoutUrl,
      qrCode: response.qrCode,
      amount,
    };
  }

  // ✅ Xử lý webhook từ PayOS
  async handleWebhook(body: any) {
    try {
      this.logger.log(`📩 Webhook received: ${JSON.stringify(body)}`);

      // 1️⃣ Xác thực chữ ký webhook
      const isValid = this.verifyWebhookSignature(body.data, body.signature);
      if (!isValid) {
        this.logger.warn('❌ Webhook signature invalid!');
        return { success: false, message: 'Invalid signature' };
      }

      this.logger.log('✅ Webhook verified successfully!');

      // 2️⃣ Lấy dữ liệu chính từ webhook
      const { orderCode, amount, code, desc, reference, transactionDateTime } =
        body.data;

      /**
       *  Lưu ý:
       * - PayOS KHÔNG gửi trường `status` hay `transactionId`
       * - `code === "00"` nghĩa là thanh toán thành công
       * - `reference` chính là mã giao dịch ngân hàng (transactionId)
       */
      const isSuccess = code === '00';

      // 3️⃣ Tìm bản ghi thanh toán tương ứng
      const payment = await this.paymentRepo.findOne({
        where: { orderId: orderCode.toString() },
        relations: ['product'],
      });

      if (!payment) {
        throw new NotFoundException(
          `Không tìm thấy giao dịch với orderCode: ${orderCode}`,
        );
      }

      // 4️⃣ Nếu đã xử lý rồi thì bỏ qua
      if (payment.status === 'SUCCESS') {
        this.logger.warn(`⚠️ Giao dịch #${orderCode} đã xử lý trước đó.`);
        return { success: true, message: 'Already processed' };
      }

      // 5️⃣ Nếu thanh toán thành công
      if (isSuccess) {
        payment.status = 'SUCCESS';
        payment.transactionId = reference;
        payment.paidAt = new Date(transactionDateTime);
        await this.paymentRepo.save(payment);

        // Cập nhật thông tin sản phẩm tương ứng
        const product = payment.product;
        const now = new Date();

        if (payment.packageType === PromotionType.BOOST) {
          product.priority_level = 1;
          product.is_premium = false;
          product.promotion_type = PromotionType.BOOST;
          product.promotion_expire_at = new Date(
            now.setDate(now.getDate() + 7),
          );
        } else if (payment.packageType === PromotionType.PRIORITY) {
          product.priority_level = 2;
          product.is_premium = true;
          product.promotion_type = PromotionType.PRIORITY;
          product.promotion_expire_at = new Date(
            now.setDate(now.getDate() + 14),
          );
        }

        await this.productRepo.save(product);

        this.logger.log(
          `✅ Thanh toán thành công #${orderCode} (${amount} VND) - Cập nhật sản phẩm #${product.id}`,
        );

        return { success: true, message: 'Payment processed successfully' };
      }

      // 6️⃣ Nếu thanh toán thất bại
      payment.status = 'FAILED';
      await this.paymentRepo.save(payment);

      this.logger.warn(
        `⚠️ Thanh toán thất bại #${orderCode} - Mã code: ${code}, desc: ${desc}`,
      );

      return { success: false, message: 'Payment failed' };
    } catch (error) {
      this.logger.error(`❌ Lỗi xử lý webhook: ${error.message}`, error.stack);
      throw new BadRequestException('Error handling PayOS webhook');
    }
  }
}
