import { Exclude } from 'class-transformer';
import { Product } from 'src/modules/products/entities/product.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';

@Entity('product_addresses')
export class ProductAddress {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({
    name: 'specific_address',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  specificAddress: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ward: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  // Liên kết 1-1 với Product
  @OneToOne(() => Product, (product) => product.address, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
