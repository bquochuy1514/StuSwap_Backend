// google-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const res = context.switchToHttp().getResponse();
    const req = context.switchToHttp().getRequest();

    //  Nếu đã xử lý rồi, bỏ qua lần chạy thứ 2
    if (req._authHandled) {
      return user || req.user; // Return user đã có
    }

    //  Đánh dấu đã xử lý
    req._authHandled = true;

    // Nếu có lỗi hoặc không có user
    if (err || !user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=invalid_email`,
      );
    }

    return user;
  }
}
