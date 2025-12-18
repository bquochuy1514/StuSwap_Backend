import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UserRole } from '../enums/user.enum';
import { Product } from 'src/modules/products/entities/product.entity';
import { Address } from 'src/modules/addresses/entities/address.entity';
import { Order } from 'src/modules/orders/entities/order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  password: string;

  @Column({ name: 'full_name', type: 'varchar' })
  fullName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', default: '/images/users/default_avatar.jpg' })
  avatar: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  // --- Profile information ---
  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  university: string;

  @OneToOne(() => Address, (address) => address.user, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  address: Address;

  // --- Account verification fields ---
  @Column({ name: 'code_id', type: 'varchar', nullable: true })
  codeId: string;

  @Column({ name: 'code_expiration', type: 'timestamp', nullable: true })
  codeExpiration: Date;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  // --- Password reset OTP flow ---
  @Column({ name: 'code_otp', type: 'varchar', length: 6, nullable: true })
  codeOTP: string;

  @Column({ name: 'code_otp_expiration', type: 'timestamp', nullable: true })
  codeOTPExpiration: Date;

  @Column({ name: 'is_otp_verified', type: 'boolean', default: false })
  isOtpVerified: boolean;

  @Column({ nullable: true })
  hashedRefreshToken: string;

  // ============================================
  // FREE TIER - Reset theo chu kỳ 30 ngày
  // ============================================
  @Column({ name: 'free_post_quota', type: 'int', default: 5 })
  freePostQuota: number; // Tổng số bài FREE được đăng (mặc định 5)

  @Column({ name: 'free_post_used', type: 'int', default: 0 })
  freePostUsed: number; // Số bài FREE đã dùng

  @Column({ name: 'free_quota_reset_at', type: 'timestamp', nullable: true })
  freeQuotaResetAt: Date; // Thời điểm reset FREE quota (30 ngày kể từ lần đầu dùng)

  // ============================================
  // MEMBERSHIP TIER - Có thời hạn rõ ràng`
  // ============================================
  @Column({ name: 'membership_type', type: 'varchar', nullable: true })
  membershipType: string | null; // 'BASIC', 'PREMIUM', 'VIP' hoặc null

  @Column({ name: 'membership_expires_at', type: 'timestamp', nullable: true })
  membershipExpiresAt: Date | null; // Ngày hết hạn membership

  @Column({ name: 'membership_post_quota', type: 'int', nullable: true })
  membershipPostQuota: number | null; // 20, 50, 150, hoặc null (unlimited cho VIP)

  @Column({ name: 'membership_post_used', type: 'int', default: 0 })
  membershipPostUsed: number; // Số bài đã dùng trong membership

  // --- Timestamps ---
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  // --- Relationship ---
  @OneToMany(() => Product, (product) => product.user)
  products: Product[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];
}
