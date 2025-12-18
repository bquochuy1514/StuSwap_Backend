/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { Repository } from 'typeorm';
import { Product } from 'src/modules/products/entities/product.entity';
import { UsersService } from 'src/modules/users/users.service';
import * as crypto from 'crypto';
import { ProductsService } from 'src/modules/products/products.service';
import { Package } from 'src/modules/packages/entities/package.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Order } from 'src/modules/orders/entities/order.entity';

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
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly usersService: UsersService,
    private readonly productsService: ProductsService,
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

  async createPromotionPayment({
    pkg,
    user,
    productId,
  }: {
    pkg: Package;
    user: User;
    productId: number;
  }) {
    // 1) Kiểm tra product tồn tại
    const product = await this.productRepo.findOne({
      where: {
        id: productId,
        user: { id: user.id },
      },
    });

    if (!product) {
      throw new NotFoundException(
        'Tin đăng không tồn tại hoặc không thuộc quyền sở hữu',
      );
    }

    // 2) Tạo ORDER trước (status = PENDING)
    const order = this.ordersRepo.create({
      user,
      package: pkg,
      product,
      amount: pkg.price,
      status: 'PENDING',
      type: 'PROMOTION',
    });

    const savedOrder = await this.ordersRepo.save(order);

    // 3) Tạo PAYMENT record (PENDING)
    const orderCode = Math.floor(Date.now() / 1000);
    const payment = this.paymentRepo.create({
      order: savedOrder,
      provider: 'PAYOS',
      provider_order_id: orderCode,
      transaction_id: null,
      amount: pkg.price,
      status: 'PENDING',
      raw_data: null,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // 4) Gọi PayOS để tạo payment link
    let payosResponse;
    try {
      payosResponse = await this.payOS.paymentRequests.create({
        amount: Number(pkg.price),
        description: `${pkg.display_name} - SP #${productId}`,
        orderCode,
        returnUrl: `${this.configService.get('FRONTEND_URL')}/payment/${pkg.package_type}/success?product_id=${productId}&package_id=${pkg.id}`,
        cancelUrl: `${this.configService.get('FRONTEND_URL')}/payment/${pkg.package_type}/cancel?product_id=${productId}&package_id=${pkg.id}`,
      });
    } catch (error) {
      // Nếu gọi PayOS fail → xoá payment để tránh rác
      await this.paymentRepo.remove(savedPayment);
      throw new BadRequestException('Không thể tạo yêu cầu thanh toán PayOS');
    }

    if (!payosResponse?.checkoutUrl) {
      throw new BadRequestException('Không thể tạo link thanh toán PayOS');
    }

    // 5) Update raw_data từ response PayOS
    savedPayment.raw_data = payosResponse;

    await this.paymentRepo.save(savedPayment);

    // 6) Trả link về FE
    return {
      checkoutUrl: payosResponse.checkoutUrl,
      orderId: savedOrder.id,
      paymentId: savedPayment.id,
    };
  }

  async createRenewPayment({
    pkg,
    user,
    productId,
  }: {
    pkg: Package;
    user: User;
    productId: number;
  }) {
    // 1) Kiểm tra product tồn tại & thuộc user
    const product = await this.productRepo.findOne({
      where: { id: productId, user: { id: user.id } },
    });

    if (!product) {
      throw new NotFoundException(
        'Tin đăng không tồn tại hoặc không thuộc quyền sở hữu',
      );
    }

    // 2) Tạo ORDER trước
    const order = this.ordersRepo.create({
      user,
      product,
      package: pkg,
      amount: pkg.price,
      status: 'PENDING',
      type: 'RENEW',
    });

    const savedOrder = await this.ordersRepo.save(order);

    // 3) Tạo PAYMENT record
    const orderCode = Math.floor(Date.now() / 1000);

    const payment = this.paymentRepo.create({
      order: savedOrder,
      provider: 'PAYOS',
      provider_order_id: orderCode,
      transaction_id: null,
      amount: pkg.price,
      status: 'PENDING',
      raw_data: null,
    });

    const savedPayment = await this.paymentRepo.save(payment);

    // 4) Gọi PayOS để tạo Payment Link
    let payosResponse;
    try {
      payosResponse = await this.payOS.paymentRequests.create({
        amount: Number(pkg.price),
        description: `${pkg.display_name} - SP #${productId}`,
        orderCode,
        returnUrl: `${this.configService.get('FRONTEND_URL')}/payment/${pkg.package_type}/success?product_id=${productId}&package_id=${pkg.id}`,
        cancelUrl: `${this.configService.get('FRONTEND_URL')}/payment/${pkg.package_type}/cancel?product_id=${productId}&package_id=${pkg.id}`,
      });
    } catch (err) {
      // Nếu gọi PayOS fail → xoá payment để tránh rác
      await this.paymentRepo.remove(savedPayment);
      throw new BadRequestException('Không thể tạo yêu cầu thanh toán PayOS');
    }

    if (!payosResponse?.checkoutUrl) {
      throw new BadRequestException('Không thể tạo link thanh toán PayOS');
    }

    // 5) Update raw_data từ response PayOS
    savedPayment.raw_data = payosResponse;

    await this.paymentRepo.save(savedPayment);

    // 6) Trả link về FE
    return {
      checkoutUrl: payosResponse.checkoutUrl,
      orderId: savedOrder.id,
      paymentId: savedPayment.id,
    };
  }

  //  Xử lý webhook từ PayOS
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
      const {
        orderCode,
        // amount,
        code,
        //  desc,
        reference,
        transactionDateTime,
      } = body.data;

      /**
       *  Lưu ý:
       * - PayOS KHÔNG gửi trường `status` hay `transactionId`
       * - `code === "00"` nghĩa là thanh toán thành công
       * - `reference` chính là mã giao dịch ngân hàng (transactionId)
       */
      const isSuccess = code === '00';

      // 3️⃣ Tìm bản ghi Payment tương ứng
      const payment = await this.paymentRepo.findOne({
        where: { provider_order_id: orderCode },
        relations: ['order', 'order.product', 'order.package'],
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

      // 5️⃣ Cập nhật Payment và Order
      payment.status = isSuccess ? 'SUCCESS' : 'FAILED';
      payment.transaction_id = reference || null;
      payment.paid_at = isSuccess ? new Date(transactionDateTime) : null;
      payment.raw_data = body;
      await this.paymentRepo.save(payment);

      // Cập nhật trạng thái Order tương ứng
      payment.order.status = isSuccess ? 'PAID' : 'FAILED';
      await this.ordersRepo.save(payment.order);

      // 6️⃣ Trigger logic business nếu thanh toán thành công
      const pkgType = payment.order.package.package_type;
      const product = payment.order.product;
      const pkg = payment.order.package;

      if (isSuccess) {
        switch (pkgType) {
          case 'PROMOTION':
            if (isSuccess && payment.order.product) {
              await this.productsService.markAsPromotion(
                payment.order.product.id,
                payment.order.package,
              );
              this.logger.log(
                `✅ Đẩy tin thành công cho sản phẩm #${payment.order.product.id}`,
              );
            }
            break;

          case 'RENEW':
            const duration = pkg.extend_days;
            await this.productsService.extendProductExpiry(
              product.id,
              duration,
            );

            this.logger.log(
              `🔄 [RENEW] Gia hạn tin thành công cho sản phẩm #${product.id} (+${duration} ngày)`,
            );
            break;

          default:
            this.logger.warn(
              `⚠️ Loại gói không xác định cho orderCode #${orderCode}`,
            );
            break;
        }
      }

      return {
        success: isSuccess,
        message: isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại',
      };
    } catch (error) {
      this.logger.error(`❌ Lỗi xử lý webhook: ${error.message}`, error.stack);
      throw new BadRequestException('Lỗi khi xử lý webhook PayOS');
    }
  }
}
