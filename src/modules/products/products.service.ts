/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { SerializedUser } from 'src/common/types';
import * as path from 'path';
import * as fs from 'fs';
import dayjs from 'dayjs';
import { CategoriesService } from '../categories/categories.service';
import { ProductAddress } from '../product_addresses/entities/product_address.entity';
import { ProductStatus, PromotionType } from './enums/product.enum';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Package } from '../packages/entities/package.entity';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
    @InjectRepository(ProductAddress)
    private productAddressRepository: Repository<ProductAddress>,
  ) {}

  async handleGetOriginProduct(id: number) {
    const productDB = await this.productsRepository.findOne({
      where: { id },
      relations: ['address'],
    });

    if (!productDB) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return productDB;
  }

  async handleCreateProduct(
    user: any,
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    // 1 Lấy user TypeORM entity
    const userDB = await this.usersService.handleGetUserProfile(user);
    if (!userDB) throw new UnauthorizedException('Người dùng không tồn tại');

    // 2 Kiểm tra category
    let category = null;
    if (createProductDto.category_id) {
      category = await this.categoriesService.handleGetCategoryById(
        createProductDto.category_id,
      );
      if (!category) {
        throw new BadRequestException('Category không tồn tại');
      }
    }

    // 3 Xử lý hình ảnh
    const imageUrls: string[] =
      files?.map(
        (file) => `${process.env.APP_URL}/images/products/${file.filename}`,
      ) || [];

    const DISPLAY_DAYS = 60;
    const now = new Date();
    const expireAt = new Date(
      now.getTime() + DISPLAY_DAYS * 24 * 60 * 60 * 1000,
    );

    // 4 Tạo product trước
    const product = this.productsRepository.create({
      title: createProductDto.title,
      description: createProductDto.description,
      price: createProductDto.price,
      condition: createProductDto.condition,
      category,
      user: userDB,
      image_urls: JSON.stringify(imageUrls),
      expire_at: expireAt, // tin sẽ hết hạn sau 60 ngày
      promotion_type: PromotionType.NONE, // chưa chọn gói nào
      promotion_expire_at: null,
    });

    // Lưu product trước để có ID
    const savedProduct = await this.productsRepository.save(product);

    // 5 Nếu có địa chỉ -> tạo ProductAddress riêng, gắn product sau khi có id
    if (createProductDto.address) {
      const { specificAddress, ward, district, province } =
        createProductDto.address;

      const address = this.productAddressRepository.create({
        specificAddress,
        ward,
        district,
        province,
        product: savedProduct, // giờ product đã có id thật
      });

      await this.productAddressRepository.save(address);
    }

    // 6 Lấy lại sản phẩm có quan hệ đầy đủ
    const fullProduct = await this.productsRepository.findOne({
      where: { id: savedProduct.id },
      relations: ['user', 'category', 'address'],
    });

    // 7 Trả response
    return {
      message: 'Đăng tin thành công!',
      product: {
        ...fullProduct,
        user: new SerializedUser(userDB),
      },
    };
  }

  async handleFindAllProducts() {
    const products = await this.productsRepository.find({
      where: { status: ProductStatus.APPROVED },
      relations: ['user', 'category', 'address'],
      order: { created_at: 'DESC' },
    });

    // map user sang SerializedUser
    return products.map((product) => ({
      ...product,
      user: new SerializedUser(product.user),
    }));
  }

  async handleGetMyProducts(user: any) {
    const products = await this.productsRepository.find({
      where: { user: { id: user.id } },
      order: {
        // Sắp xếp: chưa hết hạn lên trước, sau đó theo ngày tạo
        is_expired: 'ASC',
        created_at: 'DESC',
      },
      relations: ['category', 'address'],
      withDeleted: true, // Lấy cả tin đã ẩn
    });

    return products;
  }

  async handleFindAllForAdmin() {
    const products = await this.productsRepository.find({
      relations: ['user', 'category', 'address'],
      order: { created_at: 'DESC' },
    });

    // map user sang SerializedUser
    return products.map((product) => ({
      ...product,
      user: new SerializedUser(product.user),
    }));
  }

  async handleGetProductById(id: number) {
    const productDB = await this.productsRepository.findOne({
      where: { id },
      relations: ['user', 'category', 'address'],
    });

    if (!productDB) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return {
      ...productDB,
      user: new SerializedUser(productDB.user),
    };
  }

  async handleUpdateProduct(
    id: number,
    user: any,
    updateProductDto: UpdateProductDto,
    files: Express.Multer.File[],
  ) {
    const userDB = await this.usersService.findUserByEmail(user.email);
    const productDB = await this.productsRepository.findOne({
      where: { id },
      relations: ['user', 'category'],
    });

    if (!productDB) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    if (userDB.id !== productDB.user.id && userDB.role !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền sửa sản phẩm này');
    }

    // Parse mảng ảnh hiện tại
    // eslint-disable-next-line prefer-const
    let oldImages: string[] = productDB.image_urls
      ? JSON.parse(productDB.image_urls)
      : [];

    // Parse danh sách ảnh muốn giữ lại
    let keepImages: string[] = [];
    if (updateProductDto['keepImages']) {
      keepImages = JSON.parse(updateProductDto['keepImages']);
    }

    // Tìm ảnh nào cần xóa (có trong oldImages nhưng không nằm trong keepImages)
    const deleteImages = oldImages.filter((img) => !keepImages.includes(img));

    // Xóa ảnh bị loại khỏi file system
    await Promise.all(
      deleteImages.map((url) => {
        const filePath = path.join(
          __dirname,
          '../../../public/images/products',
          path.basename(url),
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }),
    );

    // Thêm ảnh mới (nếu có)
    const newImages =
      files?.map(
        (file) => `${process.env.APP_URL}/images/products/${file.filename}`,
      ) || [];

    // Tổng hợp danh sách ảnh cuối cùng
    const finalImages = [...keepImages, ...newImages];

    // Update dữ liệu
    await this.productsRepository.update(
      { id },
      { ...updateProductDto, image_urls: JSON.stringify(finalImages) },
    );

    // Lấy lại sản phẩm sau khi update
    const updatedProduct = await this.productsRepository.findOne({
      where: { id },
      relations: ['user', 'category'],
    });

    return {
      message: 'Cập nhật sản phẩm thành công',
      product: {
        ...updatedProduct,
        user: new SerializedUser(updatedProduct.user),
      },
    };
  }

  async hideProduct(productId: number, user: any) {
    const userId = user.id;
    const product = await this.productsRepository.findOne({
      where: { id: productId, user: { id: userId } },
    });

    if (!product) {
      throw new Error('Không tìm thấy sản phẩm');
    }

    // Soft delete - set deleted_at
    await this.productsRepository.softRemove(product);

    return { message: 'Đã ẩn sản phẩm thành công' };
  }

  async unhideProduct(productId: number, user: any) {
    const userId = user.id;

    // Tìm sản phẩm bao gồm cả soft-deleted
    const product = await this.productsRepository.findOne({
      where: { id: productId, user: { id: userId } },
      withDeleted: true, // 👈 để có thể tìm thấy sản phẩm đã bị soft delete
    });

    if (!product) {
      throw new Error(
        'Không tìm thấy sản phẩm hoặc bạn không có quyền truy cập',
      );
    }

    if (!product.deleted_at) {
      return { message: 'Sản phẩm này đang hiển thị rồi' };
    }

    // Restore lại tin (bỏ deleted_at)
    await this.productsRepository.restore(productId);

    return { message: 'Đã hiển thị lại sản phẩm thành công' };
  }

  async markAsPromotion(productId: number, pkg: Package) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm để cập nhật.');
    }

    // Cập nhật promotion type
    if (pkg.promotion_type === 'BOOST') {
      product.promotion_type = PromotionType.BOOST;
      product.promotion_expire_at = new Date(
        Date.now() + pkg.duration_hours * 3600 * 1000,
      );
    } else if (pkg.promotion_type === 'PRIORITY') {
      product.promotion_type = PromotionType.PRIORITY;
      product.promotion_expire_at = new Date(
        Date.now() + pkg.duration_hours * 3600 * 1000,
      );
    }
    product.priority_level = pkg.priority_level;

    await this.productsRepository.save(product);

    return product;
  }

  async extendProductExpiry(productId: number, extendedDays: number) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm để cập nhật.');
    }

    const currentExpiry = product.expire_at
      ? dayjs(product.expire_at)
      : dayjs();

    const newExpiry = currentExpiry.add(extendedDays, 'day');

    product.expire_at = newExpiry.toDate();
    await this.productsRepository.save(product);

    return {
      success: true,
      message: `Gia hạn thành công ${extendedDays} ngày cho sản phẩm #${productId}`,
      oldExpiry: currentExpiry.format('YYYY-MM-DD HH:mm:ss'),
      newExpiry: newExpiry.format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleExpiredPromotions() {
    const now = new Date();

    // Lấy các tin đã hết hạn promotion
    const expiredProducts = await this.productsRepository.find({
      where: {
        promotion_expire_at: LessThan(now),
        promotion_type: Not(PromotionType.NONE),
      },
    });

    if (expiredProducts.length === 0) {
      this.logger.log('✅ Không có sản phẩm nào hết hạn tin đẩy.');
      return;
    }

    // Reset về trạng thái thường
    for (const product of expiredProducts) {
      product.promotion_type = PromotionType.NONE;
      product.promotion_expire_at = null;
      product.priority_level = 0;
      await this.productsRepository.save(product);
    }

    this.logger.log(
      `⏳ Đã reset ${expiredProducts.length} sản phẩm hết hạn tin đẩy.`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredProducts() {
    const now = new Date();

    const expiredProducts = await this.productsRepository.find({
      where: {
        expire_at: LessThan(now),
        is_expired: false, // Chưa được đánh dấu
        deleted_at: IsNull(), // Chưa bị ẩn thủ công
      },
    });

    if (expiredProducts.length === 0) {
      this.logger.log('✅ Không có sản phẩm nào hết hạn hiển thị.');
      return;
    }

    // CHỈ cập nhật cờ is_expired, KHÔNG soft delete
    await this.productsRepository.update(
      { id: In(expiredProducts.map((p) => p.id)) },
      { is_expired: true },
    );

    this.logger.log(
      `⏰ Đã đánh dấu ${expiredProducts.length} sản phẩm hết hạn hiển thị.`,
    );
  }
}
