import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email phải có định dạng hợp lệ' })
  @Matches(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.edu(\.vn)?$/, {
    message: 'Chỉ chấp nhận email có đuôi .edu hoặc .edu.vn',
  })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa và 1 số',
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;

  @IsString({ message: 'Xác nhận mật khẩu phải là chuỗi ký tự' })
  @Match('password', { message: 'Mật khẩu xác nhận không khớp' })
  @IsNotEmpty({ message: 'Xác nhận mật khẩu không được để trống' })
  confirmPassword: string;

  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;
}
