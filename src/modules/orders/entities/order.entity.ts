import { Package } from 'src/modules/packages/entities/package.entity';
import { Payment } from 'src/modules/payments/entities/payment.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => User, (user) => user.orders, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Package, (pkg) => pkg.orders, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({ name: 'package_id' })
  package: Package;

  @Column({
    type: 'enum',
    enum: ['PROMOTION', 'RENEW', 'MEMBERSHIP'],
    default: 'PROMOTION',
  })
  type: 'PROMOTION' | 'RENEW' | 'MEMBERSHIP';

  @ManyToOne(() => Product, (product) => product.orders, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'product_id' })
  product: Product | null; // null nếu mua membership

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
