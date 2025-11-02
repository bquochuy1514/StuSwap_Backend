import { Module } from '@nestjs/common';
import { ProductAddressesService } from './product_addresses.service';
import { ProductAddressesController } from './product_addresses.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductAddress } from './entities/product_address.dto';

@Module({
  imports: [TypeOrmModule.forFeature([ProductAddress])],
  controllers: [ProductAddressesController],
  providers: [ProductAddressesService],
})
export class ProductAddressesModule {}
