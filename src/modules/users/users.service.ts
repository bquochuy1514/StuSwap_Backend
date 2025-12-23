import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { SerializedUser } from 'src/common/types';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateProfileDto } from './dto/update-user-profile.dto';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  comparePassword,
  hashPassword,
} from 'src/common/utils/password-hash.util';
import { Address } from '../addresses/entities/address.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Package } from '../packages/entities/package.entity';
import { ProductStatus } from '../products/enums/product.enum';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly configService: ConfigService,
    @InjectRepository(Address)
    private addressesRepository: Repository<Address>,
  ) {}

  private getMembershipLevel(type: string): number {
    const levels = {
      BASIC: 1,
      PREMIUM: 2,
      VIP: 3,
    };
    return levels[type] || 0;
  }

  private formatAvatarUrl(avatarPath: string): string {
    const baseUrl = this.configService.get<string>('APP_URL');
    if (!avatarPath) {
      return `${baseUrl}/images/users/default_avatar.jpg`;
    }
    if (avatarPath.startsWith('http')) {
      return avatarPath;
    }
    return `${baseUrl}${avatarPath}`;
  }

  async findUserByEmail(email: string) {
    return await this.usersRepository.findOne({
      where: { email },
      relations: ['address'],
    });
  }

  async handleGetUserProfile(payload: any) {
    const user = await this.findUserByEmail(payload.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.avatar = this.formatAvatarUrl(user.avatar);
    return user;
  }

  async handleUpdateUserProfile(
    user: any,
    updateProfileDto: UpdateProfileDto,
    avatarFile?: Express.Multer.File,
  ) {
    // 1. Lấy user từ DB
    const userDB = await this.findUserByEmail(user.email);
    if (!userDB) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // 2. Cập nhật avatar nếu có
    if (avatarFile) {
      const oldAvatar = userDB.avatar; // lưu tên ảnh cũ

      // Update avatar mới
      updateProfileDto.avatar = `/images/users/${avatarFile.filename}`;

      // Xóa avatar cũ nếu không phải default
      const defaultAvatars = ['default_avatar.jpg', 'admin.jpg'];
      if (
        oldAvatar &&
        !defaultAvatars.some((name) => oldAvatar.includes(name))
      ) {
        const filePath = join(process.cwd(), 'public', oldAvatar); // path tuyệt đối
        try {
          await unlink(filePath);
        } catch (err) {
          console.warn('Không thể xóa ảnh cũ:', filePath, err.message);
          // không throw để user vẫn update được
        }
      }
    }

    // 4. Xử lý address (tạo mới nếu chưa có)
    if (updateProfileDto.address) {
      const { specificAddress, ward, district, province } =
        updateProfileDto.address;

      if (userDB.address) {
        // Đã có address -> update
        await this.addressesRepository.update(userDB.address.id, {
          specificAddress,
          ward,
          district,
          province,
        });
      } else {
        // Chưa có address -> tạo mới
        const newAddress = this.addressesRepository.create({
          specificAddress,
          ward,
          district,
          province,
          user: userDB,
        });
        await this.addressesRepository.save(newAddress);
      }
    }

    // 5. Update các field khác của user
    delete updateProfileDto.address; // Xoá để tránh lỗi vì ta đã xử lý riêng cập nhật user address ở trên
    await this.usersRepository.update(userDB.id, {
      ...updateProfileDto,
    });

    // 5. Lưu thay đổi
    return new SerializedUser(
      await this.usersRepository.findOne({
        where: { id: userDB.id },
        relations: ['address'],
      }),
    );
  }

  async handleChangeUserPassword(
    user: any,
    changePasswordDto: ChangePasswordDto,
  ) {
    const userDB = await this.findUserByEmail(user.email);
    if (!userDB) throw new NotFoundException('Không tồn tại người dùng');

    const isMatchedPassword = await comparePassword(
      changePasswordDto.currentPassword,
      userDB.password,
    );

    if (!isMatchedPassword)
      throw new BadRequestException('Mật khẩu hiện tại không chính xác!');

    const newPassword = await hashPassword(changePasswordDto.newPassword);

    userDB.password = newPassword;

    await this.usersRepository.update(
      { id: userDB.id },
      { password: newPassword },
    );

    return {
      message: 'Cập nhật mật khẩu thành công!',
    };
  }

  async handleGetAllUsers() {
    const usersDB = await this.usersRepository.find();
    const users = usersDB.map((userDB) => new SerializedUser(userDB));
    return users;
  }

  async handleGetUser(id: number) {
    const userDB = await this.usersRepository.findOne({ where: { id } });
    return new SerializedUser(userDB);
  }

  async handleUpdateUser(id: number, adminUpdateUserDto: AdminUpdateUserDto) {
    // 1. Lấy user từ DB
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // 2. Cập nhật các field admin được phép
    if (adminUpdateUserDto.role) {
      user.role = adminUpdateUserDto.role;
    }

    if (adminUpdateUserDto.isActive !== undefined) {
      user.isActive = adminUpdateUserDto.isActive;
    }

    // 3. Lưu vào DB
    const updatedUser = await this.usersRepository.save(user);

    // 4. Trả về dữ liệu đã serialize
    return new SerializedUser(updatedUser);
  }

  async handleDeleteUser(id: number) {
    // 1. Lấy user
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    // 2. Soft delete (deactivate)
    user.isActive = false;

    // 3. Lưu thay đổi
    await this.usersRepository.save(user);

    return { message: 'Người dùng đã bị vô hiệu hóa' };
  }

  /**
   * Kiểm tra và xử lý quota khi user đăng bài
   * @returns { canPost: boolean, reason?: string, remainingQuota: number }
   */
  async checkAndConsumePostQuota(userId: number): Promise<{
    canPost: boolean;
    reason?: string;
    remainingQuota: number;
    quotaType: 'FREE' | 'MEMBERSHIP';
  }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const now = new Date();

    // ============================================
    // BƯỚC 1: Check MEMBERSHIP trước (ưu tiên cao hơn)
    // ============================================
    if (user.membershipType && user.membershipExpiresAt) {
      // Kiểm tra membership còn hạn không
      if (user.membershipExpiresAt > now) {
        // Membership còn hạn

        // VIP = unlimited posts
        if (user.membershipPostQuota === null) {
          return {
            canPost: true,
            remainingQuota: -1, // -1 nghĩa là unlimited
            quotaType: 'MEMBERSHIP',
          };
        }

        // Membership có giới hạn (BASIC, PREMIUM)
        if (user.membershipPostUsed < user.membershipPostQuota) {
          // Còn quota → trừ 1
          user.membershipPostUsed += 1;
          await this.usersRepository.save(user);

          return {
            canPost: true,
            remainingQuota: user.membershipPostQuota - user.membershipPostUsed,
            quotaType: 'MEMBERSHIP',
          };
        } else {
          // Hết quota membership
          return {
            canPost: false,
            reason: `Bạn đã sử dụng hết ${user.membershipPostQuota} bài đăng trong gói ${user.membershipType}. Vui lòng nâng cấp gói hoặc chờ đến khi membership hết hạn để dùng gói FREE.`,
            remainingQuota: 0,
            quotaType: 'MEMBERSHIP',
          };
        }
      } else {
        // Membership HẾT HẠN → Reset về FREE
        user.membershipType = null;
        user.membershipExpiresAt = null;
        user.membershipPostQuota = null;
        user.membershipPostUsed = 0;
        await this.usersRepository.save(user);
        // Sau khi reset, tiếp tục check FREE bên dưới
      }
    }

    // ============================================
    // BƯỚC 2: Không có membership hoặc đã hết hạn → Dùng FREE
    // ============================================

    // Kiểm tra xem có cần reset FREE quota không (chu kỳ 30 ngày)
    if (!user.freeQuotaResetAt || user.freeQuotaResetAt <= now) {
      // Lần đầu hoặc đã hết chu kỳ → Reset FREE quota
      user.freePostUsed = 0;
      user.freeQuotaResetAt = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
      ); // +30 ngày
      await this.usersRepository.save(user);
    }

    // Check FREE quota
    if (user.freePostUsed < user.freePostQuota) {
      // Còn quota FREE → trừ 1
      user.freePostUsed += 1;
      await this.usersRepository.save(user);

      return {
        canPost: true,
        remainingQuota: user.freePostQuota - user.freePostUsed,
        quotaType: 'FREE',
      };
    } else {
      // Hết quota FREE
      const resetDate = user.freeQuotaResetAt.toLocaleDateString('vi-VN');
      return {
        canPost: false,
        reason: `Bạn đã sử dụng hết ${user.freePostQuota} bài đăng miễn phí. Quota sẽ được làm mới vào ${resetDate} hoặc bạn có thể mua gói membership để đăng thêm.`,
        remainingQuota: 0,
        quotaType: 'FREE',
      };
    }
  }

  async handleGetMembershipInfo(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['products'], // Lấy quan hệ products để tính stats
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const now = new Date();

    // ============================================
    // 1. XỬ LÝ QUOTA INFO
    // ============================================
    let quotaInfo: any;

    // Check membership còn hạn không
    const hasMembership =
      user.membershipType &&
      user.membershipExpiresAt &&
      user.membershipExpiresAt > now;

    if (hasMembership) {
      // Có membership còn hạn
      quotaInfo = {
        type: 'MEMBERSHIP',
        membershipType: user.membershipType,
        currentUsed: user.membershipPostUsed,
        totalQuota: user.membershipPostQuota,
        remaining: user.membershipPostQuota - user.membershipPostUsed,
        resetAt: null,
        expiresAt: user.membershipExpiresAt.toISOString(),
      };
    } else {
      // Không có membership → dùng FREE
      // Kiểm tra xem có cần reset FREE quota không
      if (!user.freeQuotaResetAt || user.freeQuotaResetAt <= now) {
        // Reset FREE quota nếu hết chu kỳ
        user.freePostUsed = 0;
        user.freeQuotaResetAt = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
        await this.usersRepository.save(user);
      }

      quotaInfo = {
        type: 'FREE',
        membershipType: null,
        currentUsed: user.freePostUsed,
        totalQuota: user.freePostQuota,
        remaining: user.freePostQuota - user.freePostUsed,
        resetAt: user.freeQuotaResetAt.toISOString(),
        expiresAt: null,
      };
    }

    // ============================================
    // 2. TÍNH STATS TỪ PRODUCTS
    // ============================================
    const products = user.products || [];

    // Tổng số bài đã đăng
    const totalPosts = products.length;

    // Bài đang hoạt động (chưa hết hạn)
    const activePosts = products.filter(
      (product) =>
        product.status === ProductStatus.APPROVED &&
        product.expire_at &&
        new Date(product.expire_at) > now,
    ).length;

    // Bài hết hạn
    const expiredPosts = products.filter(
      (product) => product.expire_at && new Date(product.expire_at) <= now,
    ).length;

    // ============================================
    // 3. TRẢ VỀ KẾT QUẢ
    // ============================================
    return {
      quota: quotaInfo,
      stats: {
        totalPosts,
        activePosts,
        expiredPosts,
      },
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetExpiredFreeQuotas() {
    this.logger.log('🔄 Bắt đầu reset FREE quota cho users hết hạn...');

    try {
      const now = new Date();

      // Tìm tất cả users có freeQuotaResetAt <= now (đã hết chu kỳ)
      const expiredUsers = await this.usersRepository.find({
        where: {
          freeQuotaResetAt: LessThanOrEqual(now),
        },
      });

      if (expiredUsers.length === 0) {
        this.logger.log('✅ Không có user nào cần reset FREE quota');
        return;
      }

      this.logger.log(`📝 Tìm thấy ${expiredUsers.length} users cần reset`);

      // Reset quota cho từng user
      const resetPromises = expiredUsers.map(async (user) => {
        user.freePostUsed = 0;
        user.freeQuotaResetAt = new Date(
          now.getTime() + 30 * 24 * 60 * 60 * 1000, // +30 ngày
        );
        return this.usersRepository.save(user);
      });

      await Promise.all(resetPromises);

      this.logger.log(
        `✅ Đã reset FREE quota thành công cho ${expiredUsers.length} users`,
      );
    } catch (error) {
      this.logger.error('❌ Lỗi khi reset FREE quota:', error);
    }
  }

  /**
   * Cron job: Xử lý membership hết hạn
   * Chạy mỗi ngày lúc 00:30
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredMemberships() {
    this.logger.log('🔄 Bắt đầu xử lý membership hết hạn...');

    try {
      const now = new Date();

      // Tìm users có membership hết hạn
      const expiredMembershipUsers = await this.usersRepository.find({
        where: {
          membershipExpiresAt: LessThanOrEqual(now),
        },
      });

      if (expiredMembershipUsers.length === 0) {
        this.logger.log('✅ Không có membership nào hết hạn');
        return;
      }

      this.logger.log(
        `📝 Tìm thấy ${expiredMembershipUsers.length} memberships hết hạn`,
      );

      // Reset về FREE cho từng user
      const resetPromises = expiredMembershipUsers.map(async (user) => {
        // Lưu lại thông tin cũ (nếu cần log)
        const oldType = user.membershipType;

        // Reset membership
        user.membershipType = null;
        user.membershipExpiresAt = null;
        user.membershipPostQuota = 0;
        user.membershipPostUsed = 0;

        // Khởi tạo FREE quota nếu chưa có
        if (!user.freeQuotaResetAt || user.freeQuotaResetAt <= now) {
          user.freePostUsed = 0;
          user.freeQuotaResetAt = new Date(
            now.getTime() + 30 * 24 * 60 * 60 * 1000,
          );
        }

        this.logger.log(
          `📌 User ${user.id} (${user.email}): ${oldType} → FREE`,
        );

        return this.usersRepository.save(user);
      });

      await Promise.all(resetPromises);

      this.logger.log(
        `✅ Đã xử lý ${expiredMembershipUsers.length} memberships hết hạn`,
      );
    } catch (error) {
      this.logger.error('❌ Lỗi khi xử lý membership hết hạn:', error);
    }
  }

  async upgradeMembership(userId: number, pkg: Package) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const now = new Date();

    // Tính ngày hết hạn mới
    let newExpiresAt: Date;

    // Nếu đang có membership còn hạn
    if (
      user.membershipExpiresAt &&
      user.membershipExpiresAt > now &&
      user.membershipType
    ) {
      const currentLevel = this.getMembershipLevel(user.membershipType);
      const newLevel = this.getMembershipLevel(pkg.membership_type);

      if (newLevel > currentLevel) {
        // UPGRADE: Nâng cấp lên gói cao hơn
        // → Giữ thời gian còn lại + thêm thời gian gói mới
        const remainingTime =
          user.membershipExpiresAt.getTime() - now.getTime();
        const packageDuration = pkg.membership_days * 24 * 60 * 60 * 1000;
        newExpiresAt = new Date(
          now.getTime() + remainingTime + packageDuration,
        );
      } else {
        // RENEW: Gia hạn cùng gói (newLevel === currentLevel)
        // → Cộng thêm thời gian từ ngày hết hạn hiện tại
        newExpiresAt = new Date(
          user.membershipExpiresAt.getTime() +
            pkg.membership_days * 24 * 60 * 60 * 1000,
        );
      }
    } else {
      // Chưa có membership hoặc đã hết hạn → tính từ bây giờ
      newExpiresAt = new Date(
        now.getTime() + pkg.membership_days * 24 * 60 * 60 * 1000,
      );
    }

    // Cập nhật thông tin membership
    user.membershipType = pkg.membership_type;
    user.membershipExpiresAt = newExpiresAt;
    user.membershipPostQuota = pkg.max_posts;
    user.membershipPostUsed = 0; // Reset số bài đã dùng khi nâng cấp

    await this.usersRepository.save(user);

    this.logger.log(
      `✅ User #${userId} đã nâng cấp lên ${pkg.membership_type}, hết hạn: ${newExpiresAt.toISOString()}`,
    );

    return new SerializedUser(user);
  }
}
