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
import { SearchProductDto } from './dto/search-product.dto';
import { removeVietnameseTones } from 'src/common/utils/string.utils';

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
    // ============================================
    // 1. VALIDATION CƠ BẢN
    // ============================================
    if (!files || files.length === 0) {
      throw new BadRequestException('Sản phẩm phải có ít nhất 1 ảnh');
    }

    // ============================================
    // 2. LẤY USER & CHECK QUOTA
    // ============================================
    const userDB = await this.usersService.handleGetUserProfile(user);
    if (!userDB) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    const quotaCheck = await this.usersService.checkAndConsumePostQuota(
      userDB.id,
    );
    if (!quotaCheck.canPost) {
      throw new ForbiddenException(quotaCheck.reason);
    }

    // ============================================
    // 3. VALIDATE CATEGORY
    // ============================================
    let category = null;
    if (createProductDto.category_id) {
      category = await this.categoriesService.handleGetCategoryById(
        createProductDto.category_id,
      );

      if (!category) {
        throw new BadRequestException('Category không tồn tại');
      }
    }

    // ============================================
    // 4. XỬ LÝ HÌNH ẢNH
    // ============================================
    const imageUrls: string[] = files.map(
      (file) => `/images/products/${file.filename}`,
    );

    // ============================================
    // 5. TÍNH EXPIRE DATE
    // ============================================
    const DISPLAY_DAYS = 60;
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + DISPLAY_DAYS);

    // ============================================
    // 6. TẠO PRODUCT
    // ============================================
    const product = this.productsRepository.create({
      title: createProductDto.title,
      // title_normalized sẽ tự động được tạo bởi @BeforeInsert hook
      description: createProductDto.description,
      price: createProductDto.price,
      condition: createProductDto.condition,
      category,
      user: userDB,
      image_urls: JSON.stringify(imageUrls),
      expire_at: expireAt,
      promotion_type: PromotionType.NONE,
      promotion_expire_at: null,
    });

    // Lưu product (hook sẽ tự động chạy)
    const savedProduct = await this.productsRepository.save(product);

    // ============================================
    // 7. TẠO ADDRESS (nếu có)
    // ============================================
    if (createProductDto.address) {
      const { specificAddress, ward, district, province } =
        createProductDto.address;

      const address = this.productAddressRepository.create({
        specificAddress,
        ward,
        district,
        province,
        product: savedProduct,
      });

      await this.productAddressRepository.save(address);
    }

    // ============================================
    // 8. LẤY LẠI PRODUCT ĐẦY ĐỦ
    // ============================================
    const fullProduct = await this.productsRepository.findOne({
      where: { id: savedProduct.id },
      relations: ['user', 'category', 'address'],
    });

    // ============================================
    // 9. RETURN RESPONSE
    // ============================================
    return {
      message: 'Đăng tin thành công!',
      product: {
        ...fullProduct,
        user: new SerializedUser(userDB),
      },
      quotaInfo: {
        type: quotaCheck.quotaType,
        remaining:
          quotaCheck.remainingQuota === -1
            ? 'Không giới hạn'
            : `${quotaCheck.remainingQuota} bài`,
      },
    };
  }

  async handleUpdateProduct(
    id: number,
    user: any,
    updateProductDto: UpdateProductDto,
    files: Express.Multer.File[],
  ) {
    // ============================================
    // 1. LẤY USER & PRODUCT
    // ============================================
    const userDB = await this.usersService.findUserByEmail(user.email);

    const productDB = await this.productsRepository.findOne({
      where: { id },
      relations: ['user', 'category', 'address'], // ✅ Thêm address luôn
    });

    if (!productDB) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    // ============================================
    // 2. CHECK PERMISSION
    // ============================================
    if (userDB.id !== productDB.user.id && userDB.role !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền sửa sản phẩm này');
    }

    // ============================================
    // 3. XỬ LÝ HÌNH ẢNH
    // ============================================
    // Parse mảng ảnh hiện tại
    const oldImages: string[] = productDB.image_urls
      ? JSON.parse(productDB.image_urls)
      : [];

    // Parse danh sách ảnh muốn giữ lại
    let keepImages: string[] = [];
    if (updateProductDto['keepImages']) {
      try {
        keepImages = JSON.parse(updateProductDto['keepImages']);
      } catch (error) {
        throw new BadRequestException('keepImages phải là JSON array hợp lệ');
      }
    }

    // Tìm ảnh cần xóa
    const deleteImages = oldImages.filter((img) => !keepImages.includes(img));

    // Xóa ảnh khỏi file system
    await Promise.all(
      deleteImages.map(async (url) => {
        const filePath = path.join(
          __dirname,
          '../../../public/images/products',
          path.basename(url),
        );

        try {
          if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath); // ✅ Dùng async để tránh block
          }
        } catch (error) {
          this.logger.warn(`Failed to delete image: ${filePath}`, error);
        }
      }),
    );

    // Thêm ảnh mới
    const newImages =
      files?.map((file) => `/images/products/${file.filename}`) || [];

    // Tổng hợp ảnh cuối cùng
    const finalImages = [...keepImages, ...newImages];

    // ============================================
    // 4. VALIDATE CATEGORY (nếu có update)
    // ============================================
    if (updateProductDto.category_id) {
      const category = await this.categoriesService.handleGetCategoryById(
        updateProductDto.category_id,
      );

      if (!category) {
        throw new BadRequestException('Category không tồn tại');
      }
    }

    // ============================================
    // 5. UPDATE PRODUCT
    // ============================================
    // 🔥 Cập nhật trực tiếp entity rồi save để trigger hook
    Object.assign(productDB, {
      ...updateProductDto,
      image_urls: JSON.stringify(finalImages),
    });

    // 🔥 Hook @BeforeUpdate sẽ tự động chạy khi save
    const updatedProduct = await this.productsRepository.save(productDB);

    // ============================================
    // 6. UPDATE ADDRESS (nếu có)
    // ============================================
    if (updateProductDto.address) {
      const { specificAddress, ward, district, province } =
        updateProductDto.address;

      if (productDB.address) {
        // Update address hiện tại
        await this.productAddressRepository.update(
          { id: productDB.address.id },
          { specificAddress, ward, district, province },
        );
      } else {
        // Tạo mới nếu chưa có
        const newAddress = this.productAddressRepository.create({
          specificAddress,
          ward,
          district,
          province,
          product: updatedProduct,
        });
        await this.productAddressRepository.save(newAddress);
      }
    }

    // ============================================
    // 7. LẤY LẠI PRODUCT ĐẦY ĐỦ
    // ============================================
    const fullProduct = await this.productsRepository.findOne({
      where: { id },
      relations: ['user', 'category', 'address'],
    });

    // ============================================
    // 8. RETURN RESPONSE
    // ============================================
    return {
      message: 'Cập nhật sản phẩm thành công',
      product: {
        ...fullProduct,
        user: new SerializedUser(fullProduct.user),
      },
    };
  }

  async handleFindAllProducts() {
    const products = await this.productsRepository.find({
      where: { status: ProductStatus.APPROVED },
      relations: ['user', 'category', 'address'],
      order: { priority_level: 'DESC', created_at: 'DESC' },
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
        priority_level: 'DESC',
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

    const { user, ...productWithoutUser } = productDB;

    return {
      ...productWithoutUser,
      user: new SerializedUser(user),
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
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleExpiredPromotions() {
    const now = new Date();

    // Lấy các tin đã hết hạn promotion
    const expiredProducts = await this.productsRepository.find({
      withDeleted: true,
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
      withDeleted: true,
      where: {
        expire_at: LessThan(now),
        is_expired: false, // Chưa được đánh dấu
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

  /**
   * Tìm kiếm sản phẩm với filter và pagination
   * Hỗ trợ tìm kiếm tiếng Việt có dấu với utf8mb4_unicode_ci collation
   */
  async handleSearchProducts(searchDto: SearchProductDto) {
    const {
      q,
      categoryId,
      minPrice,
      maxPrice,
      condition,
      province,
      sortBy = 'newest',
      page = 1,
      limit = 15,
    } = searchDto;

    const query = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.user', 'user')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.address', 'address');

    // Base conditions
    query
      .where('product.status = :status', { status: ProductStatus.APPROVED })
      .andWhere('product.is_sold = :isSold', { isSold: false })
      .andWhere('product.is_expired = :isExpired', { isExpired: false })
      .andWhere('product.deleted_at IS NULL');

    // ============================================
    // TÌM KIẾM THEO TITLE_NORMALIZED
    // ============================================
    if (q && q.trim()) {
      const normalizedQuery = removeVietnameseTones(q);
      const keywords = normalizedQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 0);

      if (keywords.length > 0) {
        const searchConditions = keywords
          .map((_, index) => `product.title_normalized LIKE :keyword${index}`)
          .join(' AND ');

        const params: Record<string, string> = {};
        keywords.forEach((word, index) => {
          params[`keyword${index}`] = `%${word}%`;
        });

        query.andWhere(`(${searchConditions})`, params);
      }
    }

    // Category filter
    if (categoryId) {
      query.andWhere('product.category.id = :categoryId', { categoryId });
    }

    // Price filter
    if (minPrice !== undefined && minPrice >= 0) {
      query.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined && maxPrice >= 0) {
      query.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    // Condition filter
    if (condition && condition.length > 0) {
      query.andWhere('product.condition IN (:...conditions)', {
        conditions: condition,
      });
    }

    // Province filter
    if (province && province.trim()) {
      query.andWhere(
        'address.province COLLATE utf8mb4_unicode_ci LIKE :province',
        {
          province: `%${province.trim()}%`,
        },
      );
    }

    // Sorting
    switch (sortBy) {
      case 'newest':
        query
          .orderBy('product.priority_level', 'DESC')
          .addOrderBy('product.created_at', 'DESC');
        break;
      case 'price_asc':
        query
          .orderBy('product.priority_level', 'DESC')
          .addOrderBy('product.price', 'ASC');
        break;
      case 'price_desc':
        query
          .orderBy('product.priority_level', 'DESC')
          .addOrderBy('product.price', 'DESC');
        break;
      default:
        query.orderBy('product.created_at', 'DESC');
    }

    // Pagination
    query.skip((page - 1) * limit).take(limit);

    // Execute
    const [products, total] = await query.getManyAndCount();

    // Format response
    const data = products.map((product) => ({
      ...product,
      user: new SerializedUser(product.user),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
