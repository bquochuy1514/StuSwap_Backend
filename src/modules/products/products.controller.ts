import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  Put,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadProductImages } from './interceptors/upload-product-images.interceptor';
import { TransformImageUrlInterceptor } from 'src/common/interceptors/transform-image-url.interceptor';

@Controller('products')
@UseInterceptors(TransformImageUrlInterceptor)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(UploadProductImages())
  create(
    @Req() req,
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.handleCreateProduct(
      req.user,
      createProductDto,
      files,
    );
  }

  @Get()
  findAll() {
    return this.productsService.handleFindAllProducts();
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyProducts(@Req() req) {
    return this.productsService.handleGetMyProducts(req.user);
  }

  @Get(':id')
  getProductById(@Param('id') id: number) {
    return this.productsService.handleGetProductById(id);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(UploadProductImages())
  @Put(':id')
  updateProductById(
    @Param('id') id: number,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.productsService.handleUpdateProduct(
      id,
      req.user,
      updateProductDto,
      files,
    );
  }

  @Post(':id/hide')
  @UseGuards(JwtAuthGuard)
  deleteProductById(@Param('id') id: number, @Req() req) {
    return this.productsService.hideProduct(id, req.user);
  }

  @Post(':id/unhide')
  @UseGuards(JwtAuthGuard)
  restoreProductById(@Param('id') id: number, @Req() req) {
    return this.productsService.unhideProduct(id, req.user);
  }
}
