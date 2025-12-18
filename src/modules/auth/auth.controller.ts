import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.handleLogin(loginDto);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.handleRegister(registerDto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req) {
    return this.authService.handleLogout(req.user);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh-token')
  async refreshToken(
    @Req() req,
    // , @Res({ passthrough: true }) res
  ) {
    const result = await this.authService.handleRefreshToken(req.user);
    return result;
  }

  @Post('verify-account')
  verifyAccount(@Body() verifyAccountDto: VerifyAccountDto) {
    return this.authService.handleVerifyAccount(verifyAccountDto);
  }

  @Post('resend-code')
  resendCode(@Body() resendCodeDto: ResendCodeDto) {
    return this.authService.handleResendCode(resendCodeDto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.handleForgotPassword(forgotPasswordDto);
  }

  @Post('resend-otp')
  resendOTP(@Body('email') email: string) {
    return this.authService.handleResendOTP(email);
  }

  @Post('verify-otp')
  verifyOTP(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.handleVerifyOTP(verifyOtpDto);
  }

  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.handleResetPassword(resetPasswordDto);
  }

  @Get('google/login')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req, @Res() res) {
    if (!req.user) {
      throw new UnauthorizedException('Không thể đăng nhập bằng Google');
    }

    const response = await this.authService.loginWithGoogle(req.user);
    const { access_token, refresh_token } = response;

    // Redirect về frontend với cả access_token và refresh_token
    res.redirect(
      `${process.env.FRONTEND_URL}?access_token=${access_token}&refresh_token=${refresh_token}`,
    );
  }
}
