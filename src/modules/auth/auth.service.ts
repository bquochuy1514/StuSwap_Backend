/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import {
  comparePassword,
  hashPassword,
} from 'src/common/utils/password-hash.util';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MailerService } from '@nestjs-modules/mailer';
import * as otpGenerator from 'otp-generator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import refreshJwtConfig from './config/refresh-jwt.config';
import { ConfigType } from '@nestjs/config';
import * as argon2 from 'argon2';
import { join } from 'path';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(refreshJwtConfig.KEY)
    private refreshTokenConfig: ConfigType<typeof refreshJwtConfig>,
    private readonly mailerService: MailerService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async validateUser(loginDto: LoginDto) {
    const { email, password } = loginDto;
    // Tìm người dùng có email này trong database
    const findUser = await this.usersService.findUserByEmail(email);

    if (!findUser) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // So sánh password người dùng nhập vào và password đã được hashed trong database
    const matchedPassword = await comparePassword(password, findUser.password);

    if (!matchedPassword) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (!findUser.isActive) {
      throw new BadRequestException(
        'Tài khoản chưa được kích hoạt! Vui lòng kích hoạt tài khoản',
      );
    }

    if (findUser && matchedPassword && findUser.isActive) {
      const {
        password,
        codeId,
        codeExpiration,
        codeOTP,
        codeOTPExpiration,
        isOtpVerified,
        hashedRefreshToken,
        ...user
      } = findUser;

      return user;
    }

    return null;
  }

  async handleLogin(loginDto: LoginDto) {
    // Ở đây user chắc chắn sẽ được trả, các throw exception đã được xử lí ở validateUser
    const user = await this.validateUser(loginDto);

    const { accessToken, refreshToken } = await this.generateTokens(user);
    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.usersRepository.update({ id: user.id }, { hashedRefreshToken });

    return {
      message: 'Đăng nhập thành công',
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async handleRegister(registerDto: RegisterDto) {
    // Check existed user
    const existedUser = await this.usersService.findUserByEmail(
      registerDto.email,
    );
    if (existedUser) {
      throw new BadRequestException(
        'Email này đã tồn tại trong hệ thống. Vui lòng đăng nhập hoặc chọn email khác.',
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(registerDto.password);
    const createdUser = this.usersRepository.create({
      ...registerDto,
      codeId: uuidv4(),
      codeExpiration: dayjs().add(5, 'minutes').toDate(),
      password: hashedPassword,
    });

    // Sending email
    this.mailerService.sendMail({
      to: createdUser.email, // list of receivers
      subject: 'Kích hoạt tài khoản StudentSwap', // Subject line
      template: 'register.hbs', // HTML body content
      context: {
        name: createdUser.fullName,
        activationCode: createdUser.codeId,
      },
      attachments: [
        {
          filename: 'logo.png',
          path: join(process.cwd(), 'public/images/logo/student_swap_logo.png'),
          cid: 'logo', // Content ID để reference trong template
        },
      ],
    });

    await this.usersRepository.save(createdUser);

    return {
      message:
        'Đăng kí thành công! Vui lòng kiểm tra email để kích hoạt tài khoản',
      user: {
        id: createdUser.id,
        email: createdUser.email,
      },
    };
  }

  async handleLogout(user: any) {
    const userDB = await this.usersService.findUserByEmail(user.email);
    if (!userDB) throw new BadRequestException();

    if (!userDB.hashedRefreshToken)
      throw new BadRequestException('Internal Server Error');

    await this.usersRepository.update(
      { id: userDB.id },
      { hashedRefreshToken: null },
    );

    return { message: 'Bạn đã đăng xuất' };
  }

  async generateTokens(user: any) {
    const payload = { id: user.id, email: user.email, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, this.refreshTokenConfig),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async handleRefreshToken(user: any) {
    const { accessToken, refreshToken } = await this.generateTokens(user);

    const hashedRefreshToken = await argon2.hash(refreshToken);

    await this.usersRepository.update({ id: user.id }, { hashedRefreshToken });

    return {
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  // refreshToken ở đây được extract từ header request, nó là original refresh token chưa được hash
  async validateRefreshToken(user: any, refreshToken: string) {
    const userDB = await this.usersService.findUserByEmail(user.email);
    if (!userDB || !userDB.hashedRefreshToken)
      throw new UnauthorizedException('Invalid Refresh Token');

    const refreshTokenMatches = await argon2.verify(
      userDB.hashedRefreshToken,
      refreshToken,
    );

    if (!refreshTokenMatches)
      throw new UnauthorizedException('Invalid Refresh Token');

    return user;
  }

  // Hàm này để verify account
  async handleVerifyAccount(verifyAccountDto: VerifyAccountDto) {
    const { email, codeId } = verifyAccountDto;
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException(
        'Mã xác thực không hợp lệ hoặc đã hết hạn.',
      );
    }

    if (user.isActive) {
      throw new BadRequestException('Tài khoản đã được kích hoạt trước đó.');
    }

    // Kiểm tra code và expiration
    if (user.codeId !== codeId) {
      throw new BadRequestException(
        'Mã kích hoạt không hợp lệ hoặc đã hết hạn',
      );
    }

    if (user.codeExpiration < new Date()) {
      throw new BadRequestException(
        'Mã kích hoạt không hợp lệ hoặc đã hết hạn',
      );
    }

    // Kích hoạt account
    user.isActive = true;
    user.codeId = null;
    user.codeExpiration = null;

    await this.usersRepository.save(user);

    return { message: 'Kích hoạt tài khoản thành công! Vui lòng đăng nhập' };
  }

  // Hàm này để gửi lại mã kích hoạt tài khoản
  async handleResendCode(resendCodeDto: ResendCodeDto) {
    const { email } = resendCodeDto;

    // Kiểm tra email tồn tại
    const user = await this.usersService.findUserByEmail(email);
    if (!user) {
      throw new BadRequestException('Email không tồn tại');
    }

    if (user.isActive) {
      throw new BadRequestException('Tài khoản đã được kích hoạt rồi');
    }

    user.codeId = uuidv4();
    user.codeExpiration = dayjs().add(5, 'minutes').toDate();

    await this.usersRepository.save(user);

    // Sending email
    this.mailerService.sendMail({
      to: user.email, // list of receivers
      subject: 'Kích hoạt tài khoản StudentSwap', // Subject line
      template: 'register.hbs', // HTML body content
      context: {
        name: user.fullName,
        activationCode: user.codeId,
      },
      attachments: [
        {
          filename: 'logo.png',
          path: join(process.cwd(), 'public/images/logo/student_swap_logo.png'),
          cid: 'logo', // Content ID để reference trong template
        },
      ],
    });

    return { message: 'Mã xác nhận mới đã được gửi đến email của bạn.' };
  }

  // Hàm này chỉ để gửi mã OTP
  async handleForgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.usersService.findUserByEmail(
      forgotPasswordDto.email,
    );

    if (!user)
      throw new BadRequestException('Email không tồn tại trong hệ thống');

    const OTPCode = otpGenerator.generate(6, {
      digits: true,
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    user.codeOTP = OTPCode;

    user.codeOTPExpiration = dayjs().add(5, 'minutes').toDate();

    user.isOtpVerified = false;

    // Sending email
    await this.mailerService.sendMail({
      to: user.email, // list of receivers
      subject: 'Mã OTP để thiết lập mật khẩu mới cho tài khoản StudentSwap', // Subject line
      template: 'forgot-password.hbs', // HTML body content
      context: {
        name: user.fullName,
        activationCode: OTPCode,
      },
      attachments: [
        {
          filename: 'logo.png',
          path: join(process.cwd(), 'public/images/logo/student_swap_logo.png'),
          cid: 'logo', // Content ID để reference trong template
        },
      ],
    });

    await this.usersRepository.save(user);

    return { message: 'Vui lòng kiểm tra email để nhận mã OTP' };
  }

  // Hàm này gửi lại mã OTP
  async handleResendOTP(email: string) {
    const user = await this.usersService.findUserByEmail(email);
    if (!user) {
      throw new BadRequestException('Email không tồn tại trong hệ thống');
    }

    const OTPCode = otpGenerator.generate(6, {
      digits: true,
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    user.codeOTP = OTPCode;
    user.codeOTPExpiration = dayjs().add(5, 'minutes').toDate();
    user.isOtpVerified = false;

    // Sending email
    await this.mailerService.sendMail({
      to: user.email, // list of receivers
      subject: 'Mã OTP để thiết lập mật khẩu mới cho tài khoản StudentSwap', // Subject line
      template: 'forgot-password.hbs', // HTML body content
      context: {
        name: user.fullName,
        activationCode: OTPCode,
      },
      attachments: [
        {
          filename: 'logo.png',
          path: join(process.cwd(), 'public/images/logo/student_swap_logo.png'),
          cid: 'logo', // Content ID để reference trong template
        },
      ],
    });

    await this.usersRepository.save(user);

    return { message: 'Vui lòng kiểm tra email để nhận mã OTP' };
  }

  // Hàm này để xác nhận OTP
  async handleVerifyOTP(verifyOtpDto: VerifyOtpDto) {
    const { email, otpCode } = verifyOtpDto;
    const user = await this.usersService.findUserByEmail(email);

    if (!user)
      throw new BadRequestException('Email không tồn tại trong hệ thống');

    if (user.isOtpVerified) {
      throw new BadRequestException('Mã OTP đã được xác thực trước đó');
    }

    if (user.codeOTP !== otpCode) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    if (user.codeOTPExpiration < new Date()) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    user.codeOTP = null;
    user.codeOTPExpiration = null;
    user.isOtpVerified = true;

    await this.usersRepository.save(user);

    return { message: 'Xác thực mã OTP thành công' };
  }

  async handleResetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, password } = resetPasswordDto;

    const user = await this.usersService.findUserByEmail(email);

    if (!user)
      throw new BadRequestException('Email không tồn tại trong hệ thống');

    if (!user.isOtpVerified) {
      throw new BadRequestException(
        'Vui lòng xác thực mã OTP trước khi đổi mật khẩu',
      );
    }

    const hashedPassword = await hashPassword(password);

    user.password = hashedPassword;

    user.isOtpVerified = false;

    await this.usersRepository.save(user);

    return { message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập' };
  }

  async validateGoogleUser(googleUser: GoogleLoginDto) {
    // Nếu đã có user trong database => Trả về user đó
    const user = await this.usersService.findUserByEmail(googleUser.email);
    if (user) return user;

    // Nếu chưa có user trong database => Tạo user mới và trả về user đó
    const createdUser = this.usersRepository.create({
      ...googleUser,
      isActive: true,
      fullName: `${googleUser.firstName} ${googleUser.lastName}`,
      avatar: googleUser.avatarUrl,
    });

    return await this.usersRepository.save(createdUser);
  }

  async loginWithGoogle(user: any) {
    const userDB = await this.usersService.findUserByEmail(user.email);
    // user ở đây được Google Strategy trả về, có thể gồm id, email, name, v.v.
    const { accessToken, refreshToken } = await this.generateTokens(user);

    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.usersRepository.update(
      { id: userDB.id },
      { hashedRefreshToken },
    );

    return {
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }
}
