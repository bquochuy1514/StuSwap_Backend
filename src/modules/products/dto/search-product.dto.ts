import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ProductCondition } from '../enums/product.enum';

// Cách dùng:
// GET api/products/search?q=đồ đá bóng&categoryId=5&minPrice=50000&maxPrice=500000&condition=new,like_new&province=TP. Hồ Chí Minh&sortBy=price_asc&page=1&limit=20
// Đơn giản hơn: GET api/products/search?q=áo thun&province=Hà Nội

export class SearchProductDto {
  // ============ TÌM KIẾM ============
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  q?: string; // Keyword tìm kiếm

  // ============ LỌC CƠ BẢN ============
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(ProductCondition, { each: true })
  @Transform(({ value }) => {
    // Cho phép truyền string hoặc array
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  condition?: ProductCondition[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  province?: string; // Tỉnh/thành phố

  // ============ SẮP XẾP ============
  @IsOptional()
  @IsEnum(['newest', 'price_asc', 'price_desc', 'priority'])
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'priority' = 'newest';

  // ============ PHÂN TRANG ============
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100) // Giới hạn tối đa 100 items/page
  limit?: number = 20;
}
