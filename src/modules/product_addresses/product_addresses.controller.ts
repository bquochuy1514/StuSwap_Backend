import { Controller } from '@nestjs/common';
import { ProductAddressesService } from './product_addresses.service';

@Controller('product-addresses')
export class ProductAddressesController {
  constructor(private readonly productAddressesService: ProductAddressesService) {}
}
