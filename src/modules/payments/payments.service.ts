import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayosService } from './payos/payos.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Package } from '../packages/entities/package.entity';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Payment } from './entities/payment.entity';
import { UsersService } from '../users/users.service';
import { PromotionType } from '../products/enums/product.enum';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payosService: PayosService,

    @InjectRepository(Package)
    private readonly packagesRepo: Repository<Package>,

    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,

    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,

    private readonly userService: UsersService,
  ) {}

  async handleCreatePayOsPaymentLink(
    createPaymentDto: CreatePaymentDto,
    user: any,
  ) {
    const userDB = await this.userService.findUserByEmail(user.email);

    if (!userDB) {
      throw new NotFoundException('Người dùng không tồn tại trong hệ thống');
    }

    const { packageId, productId } = createPaymentDto;

    const pkg = await this.packagesRepo.findOne({
      where: { id: packageId },
    });

    if (!pkg) {
      throw new NotFoundException('Gói dịch vụ không tồn tại');
    }

    switch (pkg.package_type) {
      case 'PROMOTION':
        if (!productId) {
          throw new BadRequestException(
            'Gói đẩy tin yêu cầu phải có productId (tin đăng cần được đẩy)',
          );
        }

        const product = await this.productsRepo.findOne({
          where: { id: productId },
        });

        if (
          product.promotion_type !== PromotionType.NONE &&
          product.promotion_expire_at &&
          product.promotion_expire_at > new Date()
        ) {
          throw new BadRequestException(
            'Sản phẩm này đang trong thời gian khuyến mãi, không thể đẩy tin lại.',
          );
        }

        return this.payosService.createPromotionPayment({
          pkg,
          user: userDB,
          productId,
        });

      case 'RENEW':
        if (!productId) {
          throw new BadRequestException(
            'Gói gia hạn yêu cầu phải có productId (tin đăng cần được gia hạn)',
          );
        }

        // Chuyển sang service handle renew
        return this.payosService.createRenewPayment({
          pkg,
          user: userDB,
          productId,
        });

      // case 'MEMBERSHIP':
      //   // Chuyển sang service handle membership
      //   return this.payosService.createMembershipPayment({
      //     pkg,
      //     user: userDB,
      //   });

      default:
        throw new BadRequestException(
          'Loại gói này hiện chưa được hỗ trợ thanh toán',
        );
    }
  }

  handlePayOsWebhook(payload: any) {
    return this.payosService.handleWebhook(payload);
  }
}
