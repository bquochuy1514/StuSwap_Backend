import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { Product } from './entities/product.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProductAddress } from '../product_addresses/entities/product_address.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductAddress]),
    AuthModule,
    UsersModule,
    CategoriesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, JwtStrategy],
  exports: [ProductsService],
})
export class ProductsModule {}
