import { Order } from 'src/modules/orders/entities/order.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('packages')
export class Package {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ unique: true })
  key: string; // boost_6h, priority_3d, renew_15d, premium_30d

  @Column({
    type: 'enum',
    enum: ['PROMOTION', 'RENEW', 'MEMBERSHIP'],
  })
  package_type: 'PROMOTION' | 'RENEW' | 'MEMBERSHIP';

  // ---- DISPLAY ----
  @Column()
  display_name: string; // "Đẩy tin 6 giờ"

  @Column({ type: 'text', nullable: true })
  description: string | null; // Mô tả chi tiết

  // ---- PRICE ----
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price: number;

  @Column({ default: true })
  is_active: boolean;

  // ---- PROMOTION ONLY ----
  @Column({
    type: 'enum',
    enum: ['BOOST', 'PRIORITY'],
    nullable: true,
  })
  promotion_type: 'BOOST' | 'PRIORITY' | null;

  @Column({ nullable: true })
  priority_level: number | null;

  @Column({ nullable: true })
  duration_hours: number | null; // 6h, 24h, 72h,...

  // ---- RENEW ONLY ----
  @Column({ nullable: true })
  extend_days: number | null; // 7 ngày, 15 ngày,...

  // ---- MEMBERSHIP ONLY ----
  @Column({ nullable: true })
  membership_days: number | null; // 30 ngày,...

  @Column({ nullable: true })
  max_posts: number | null;

  @OneToMany(() => Order, (order) => order.package)
  orders: Order[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
