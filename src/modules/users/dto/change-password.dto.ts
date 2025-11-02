import { IsString, MinLength, Matches, IsNotEmpty } from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';
import { NotMatch } from 'src/common/decorators/not-match.decorator';

export class ChangePasswordDto {
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi' })
  @IsNotEmpty({ message: 'Mật khẩu hiện tại không được để trống' })
  currentPassword: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(6, { message: 'Mật khẩu mới phải ít nhất 6 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa và 1 số',
  })
  @NotMatch('currentPassword', {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  })
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  newPassword: string;

  @IsString({ message: 'Xác nhận mật khẩu phải là chuỗi' })
  @Match('newPassword', { message: 'Xác nhận mật khẩu không khớp' })
  @IsNotEmpty({ message: 'Xác nhận mật khẩu không được để trống' })
  confirmPassword: string;
}
