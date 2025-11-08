import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import {
  ProductCondition,
  ProductStatus,
  PromotionType,
} from '../enums/product.enum';
import { Category } from 'src/modules/categories/entities/category.entity';
import { ProductAddress } from 'src/modules/product_addresses/entities/product_address.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // Join user
  @ManyToOne(() => User, (user) => user.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price: number;

  @Column({
    type: 'enum',
    enum: ProductCondition,
    default: ProductCondition.GOOD,
  })
  condition: ProductCondition;

  // Join category
  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  // One-to-one with ProductAddress
  @OneToOne(() => ProductAddress, (address) => address.product, {
    cascade: true,
  })
  address: ProductAddress;

  @Column({ type: 'text', nullable: true })
  image_urls: string;

  @Column({ type: 'boolean', default: false })
  is_sold: boolean;

  @Column({ type: 'boolean', default: false })
  is_premium: boolean;

  @Column({ type: 'boolean', default: false })
  payment_required: boolean;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.PENDING,
  })
  status: ProductStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  reject_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expire_at: Date | null;

  @Column({
    type: 'enum',
    enum: PromotionType,
    default: PromotionType.NONE,
  })
  promotion_type: PromotionType;

  @Column({ type: 'timestamp', nullable: true })
  promotion_expire_at: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
