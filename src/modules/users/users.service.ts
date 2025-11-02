import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly configService: ConfigService,
    @InjectRepository(Address)
    private addressesRepository: Repository<Address>,
  ) {}

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

    // 3. Chuẩn hóa phone
    if (updateProfileDto.phone === undefined) {
      updateProfileDto.phone = null;
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
}
