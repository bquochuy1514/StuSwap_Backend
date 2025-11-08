import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  IsObject,
} from 'class-validator';
import { ProductCondition } from '../enums/product.enum';
import { MinWords } from 'src/common/decorators/min-words.decorator';

export class CreateProductDto {
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  @IsString({ message: 'Tên sản phẩm phải là chuỗi' })
  title: string;

  @IsString({ message: 'Mô tả sản phẩm phải là chuỗi' })
  @MinWords(10, { message: 'Mô tả sản phẩm phải có ít nhất 10 từ' })
  @IsNotEmpty({ message: 'Mô tả sản phẩm không được để trống' })
  description: string;

  @IsNumber({}, { message: 'Giá sản phẩm phải là số' })
  @Min(10000, { message: 'Giá sản phẩm tối thiểu 10.000đ' })
  @IsNotEmpty({ message: 'Giá sản phẩm không được để trống' })
  price: number;

  @IsOptional()
  @IsEnum(ProductCondition, { message: 'Tình trạng sản phẩm không hợp lệ' })
  condition?: ProductCondition;

  @IsNumber({}, { message: 'Danh mục phải là số' })
  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  category_id: number;

  // --- Địa chỉ sản phẩm ---
  @IsOptional()
  @IsObject({ message: 'Địa chỉ sản phẩm phải là một object' })
  address?: {
    specificAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
  };

  image_urls?: string;

  @IsOptional()
  @IsBoolean({ message: 'is_sold phải là kiểu boolean' })
  is_sold?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'is_premium phải là kiểu boolean' })
  is_premium?: boolean;
}
