import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { PromotionType } from 'src/modules/products/enums/product.enum';
import { PaymentPurpose } from '../dto/create-payment.dto';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  orderId: string; // Mã đơn hàng hệ thống PayOS yêu cầu (số nguyên dạng string lưu DB cho an toàn)

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number; // Số tiền cần thanh toán (BOOST = 15k, PRIORITY = 30k)

  @Column({ type: 'enum', enum: PromotionType })
  packageType: PromotionType; // Gói thanh toán: BOOST / PRIORITY

  // 🧠 Mục đích thanh toán
  @Column({
    type: 'enum',
    enum: PaymentPurpose,
    default: PaymentPurpose.PROMOTE_PRODUCT,
  })
  purpose: PaymentPurpose;

  @Column({ nullable: true })
  checkoutUrl: string; // Link thanh toán trả về từ PayOS (FE redirect tới đây)

  @Column({ nullable: true })
  transactionId: string; // ID giao dịch của PayOS (lấy từ webhook khi thành công)

  @Column({
    type: 'enum',
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'SUCCESS' | 'FAILED'; // Trạng thái thanh toán

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User; // Ai là người thanh toán

  @ManyToOne(() => Product, (product) => product.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product; // Thanh toán cho sản phẩm nào

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
