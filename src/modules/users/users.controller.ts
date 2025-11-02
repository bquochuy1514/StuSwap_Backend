import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SerializedUser } from 'src/common/types';
import { UserRole } from './enums/user.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UpdateProfileDto } from './dto/update-user-profile.dto';
import { UploadAvatar } from './interceptors/upload-avatar.interceptor';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('/profile')
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@Req() req) {
    const user = await this.usersService.handleGetUserProfile(req.user);
    return new SerializedUser(user);
  }

  @Put('/profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(UploadAvatar())
  async updateUserProfile(
    @Req() req,
    @Body() updateProfileDto: UpdateProfileDto,
    @UploadedFile() avatarFile: Express.Multer.File,
  ) {
    return await this.usersService.handleUpdateUserProfile(
      req.user,
      updateProfileDto,
      avatarFile,
    );
  }

  @Put('/change-password')
  @UseGuards(JwtAuthGuard)
  async changeUserPassword(
    @Req() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.usersService.handleChangeUserPassword(
      req.user,
      changePasswordDto,
    );
  }

  @Get('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAllUsers() {
    return this.usersService.handleGetAllUsers();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getUser(@Param('id') id: number) {
    return this.usersService.handleGetUser(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  updateUser(
    @Param('id') id: number,
    @Body() adminUpdateUserDto: AdminUpdateUserDto,
  ) {
    return this.usersService.handleUpdateUser(id, adminUpdateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteUser(@Param('id') id: number) {
    return this.usersService.handleDeleteUser(id);
  }
}
