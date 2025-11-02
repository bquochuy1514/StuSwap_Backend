import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  MaxLength,
  IsNotEmpty,
  IsObject,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Tên phải là chuỗi' })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  fullName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsPhoneNumber('VN', { message: 'Số điện thoại phải là số Việt Nam hợp lệ' })
  phone?: string;

  // --- Mới thêm ---
  @IsOptional()
  @IsString({ message: 'Giới thiệu bản thân phải là chuỗi' })
  bio?: string;

  @IsOptional()
  @IsString({ message: 'Tên trường đại học phải là chuỗi' })
  @MaxLength(100, { message: 'Tên trường không được vượt quá 100 ký tự' })
  university?: string;

  @IsOptional()
  @IsObject()
  address?: {
    specificAddress?: string;
    ward?: string;
    district?: string;
    province?: string;
  };

  @IsOptional()
  @IsString({ message: 'Avatar phải là chuỗi' })
  avatar: string;
}
