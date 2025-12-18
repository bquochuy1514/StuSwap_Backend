import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from 'src/modules/orders/entities/order.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Order, (order) => order.payments, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  provider: string; // PAYOS - sau này có thể MOMO, ZALO,...

  @Column({ unique: true })
  provider_order_id: number; // random khi tạo để tham chiếu tới mã đơn hàng của PayOS

  @Column({ nullable: true })
  transaction_id: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    default: 'PENDING',
  })
  status: 'PENDING' | 'SUCCESS' | 'FAILED';

  @Column({ type: 'json', nullable: true })
  raw_data: any; // full payload webhook PayOS

  @Column({ nullable: true })
  paid_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
