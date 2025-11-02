import { Exclude } from 'class-transformer';

export class SerializedUser {
  id: number;
  fullName: string;
  email: string;
  avatar: string;
  phone: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Ẩn tất cả field nhạy cảm
  @Exclude() password: string;
  @Exclude() codeId: string;
  @Exclude() codeExpiration: Date;
  @Exclude() codeOTP: string;
  @Exclude() codeOTPExpiration: Date;
  @Exclude() isOtpVerified: boolean;
  @Exclude() hashedRefreshToken: string;

  constructor(partial: Partial<SerializedUser>) {
    Object.assign(this, partial);
    if (this.avatar && !this.avatar.startsWith('http')) {
      this.avatar = `${process.env.APP_URL}${this.avatar}`;
    }
  }
}
