import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Min,
  IsObject,
  IsInt,
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

  @IsInt({ message: 'Danh mục phải là số nguyên' })
  @Transform(({ value }) => {
    // Nếu là empty string hoặc falsy, return undefined để @IsNotEmpty bắt
    if (!value || value === '') {
      return undefined;
    }
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
  })
  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  category_id: number;

  @IsObject()
  @IsNotEmpty({
    message:
      'Địa chỉ sản phẩm thiếu thông tin. Vui lòng điền đầy đủ các trường yêu cầu.',
  })
  address: {
    specificAddress: string;
    ward: string;
    district: string;
    province: string;
  };

  images?: string;
}
