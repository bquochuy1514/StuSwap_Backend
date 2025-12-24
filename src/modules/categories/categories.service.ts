import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UploadedFile,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Repository } from 'typeorm';
import { slugify } from 'src/common/utils/slugify';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private readonly configService: ConfigService,
  ) {}

  private formatCategoryUrl(categoryPath: string): string {
    const baseUrl = this.configService.get<string>('APP_URL');
    return `${baseUrl}${categoryPath}`;
  }

  async handleCreateCategory(
    createCategoryDto: CreateCategoryDto,
    @UploadedFile() icon: Express.Multer.File,
  ) {
    const existingCategory = await this.categoriesRepository.findOne({
      where: { name: createCategoryDto.name },
    });

    if (existingCategory) {
      throw new BadRequestException('Tên danh mục đã tồn tại');
    }

    // Tạo slug từ name
    const slug = slugify(createCategoryDto.name);

    if (icon) {
      createCategoryDto.icon_url = `${process.env.APP_URL}/images/categories/${icon.filename}`;
    }

    // Tạo entity mới
    const category = this.categoriesRepository.create({
      slug,
      ...createCategoryDto,
    });

    // Lưu vô DB
    return await this.categoriesRepository.save(category);
  }

  async handleFindAllCategories() {
    const categories = await this.categoriesRepository.find();
    const formattedCategories = categories.map((category) => {
      category.icon_url = this.formatCategoryUrl(category.icon_url);
      return category;
    });
    return formattedCategories;
  }

  async handleGetCategoryById(id: number) {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    category.icon_url = this.formatCategoryUrl(category.icon_url);
    return category;
  }

  async handleUpdateCategoryById(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    @UploadedFile() icon: Express.Multer.File,
  ) {
    // Tìm category
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');

    // Nếu update name, kiểm tra trùng tên + tạo slug
    if (updateCategoryDto.name) {
      const existingCategory = await this.categoriesRepository.findOne({
        where: { name: updateCategoryDto.name },
      });
      if (existingCategory && existingCategory.id !== id) {
        throw new BadRequestException('Tên danh mục đã tồn tại');
      }
      category.slug = slugify(updateCategoryDto.name);
      category.name = updateCategoryDto.name;
    }

    // Cập nhật các field còn lại
    if (updateCategoryDto.description) {
      category.description = updateCategoryDto.description;
    }
    if (updateCategoryDto.is_active) {
      category.is_active = updateCategoryDto.is_active;
    }

    if (icon) {
      const oldIcon = category.icon_url;
      const relativePath = new URL(oldIcon).pathname;
      category.icon_url = `${process.env.APP_URL}/images/categories/${icon.filename}`;
      const filePath = join(process.cwd(), 'public', relativePath);
      try {
        await unlink(filePath);
      } catch (err) {
        console.warn('Không thể xóa ảnh cũ:', filePath, err.message);
        // không throw để user vẫn update được
      }
    }

    // Lưu lại DB
    return await this.categoriesRepository.save(category);
  }

  async handleRemoveCategoryById(id: number) {
    // Tìm category
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Không tìm thấy danh mục');
    }

    // Xóa category
    await this.categoriesRepository.remove(category);

    return {
      message: 'Xoá danh mục thành công',
    };
  }
}
