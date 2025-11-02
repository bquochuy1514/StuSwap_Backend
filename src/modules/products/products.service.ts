/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { SerializedUser } from 'src/common/types';
import * as path from 'path';
import * as fs from 'fs';
import { CategoriesService } from '../categories/categories.service';
import { ProductAddress } from '../product_addresses/entities/product_address.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
    @InjectRepository(ProductAddress)
    private productAddressRepository: Repository<ProductAddress>,
  ) {}

  async handleCreateProduct(
    user: any,
    createProductDto: CreateProductDto,
    files: Express.Multer.File[],
  ) {
    // 1️⃣ Lấy user TypeORM entity
    const userDB = await this.usersService.handleGetUserProfile(user);
    if (!userDB) throw new UnauthorizedException('Người dùng không tồn tại');

    // 2️⃣ Kiểm tra category
    let category = null;
    if (createProductDto.category_id) {
      category = await this.categoriesService.handleGetCategoryById(
        createProductDto.category_id,
      );
      if (!category) {
        throw new BadRequestException('Category không tồn tại');
      }
    }

    // 3️⃣ Xử lý hình ảnh
    const imageUrls: string[] =
      files?.map(
        (file) => `${process.env.APP_URL}/images/products/${file.filename}`,
      ) || [];

    // 4️⃣ Tạo product trước (chưa gắn address)
    const product = this.productsRepository.create({
      title: createProductDto.title,
      description: createProductDto.description,
      price: createProductDto.price,
      condition: createProductDto.condition,
      category,
      user: userDB,
      image_urls: JSON.stringify(imageUrls),
      is_sold: createProductDto.is_sold || false,
      is_premium: createProductDto.is_premium || false,
    });

    // 👉 Lưu product trước để có ID
    const savedProduct = await this.productsRepository.save(product);

    // 5️⃣ Nếu có địa chỉ -> tạo ProductAddress riêng, gắn product sau khi có id
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

    // 6️⃣ Lấy lại sản phẩm có quan hệ đầy đủ
    const fullProduct = await this.productsRepository.findOne({
      where: { id: savedProduct.id },
      relations: ['user', 'category', 'address'],
    });

    // 7️⃣ Trả response
    return {
      message: 'Tạo sản phẩm thành công',
      product: {
        ...fullProduct,
        user: new SerializedUser(userDB),
      },
    };
  }

  async handleFindAllProducts() {
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
      relations: ['user', 'category'],
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

  async handleDeleteProductById(id: number, user: any) {
    const userDB = await this.usersService.findUserByEmail(user.email);
    const productDB = await this.productsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!productDB) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    if (userDB.id !== productDB.user.id && userDB.role !== 'admin') {
      throw new ForbiddenException('Bạn không có quyền xoá sản phẩm này');
    }

    const currentImagesUrls: string[] = JSON.parse(
      productDB.image_urls || '[]',
    );

    // Xóa ảnh khỏi file system
    await Promise.all(
      currentImagesUrls.map((url) => {
        const filePath = path.join(
          __dirname,
          '../../../public/images/products',
          path.basename(url),
        );
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }),
    );

    // Delete dữ liệu
    await this.productsRepository.delete(id);

    return {
      message: 'Xoá sản phẩm thành công',
    };
  }
}
