import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

export const UploadAvatar = () =>
  FileInterceptor('avatar', {
    storage: diskStorage({
      destination: './public/images/users', // folder lưu file
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        callback(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return callback(new Error('Chỉ cho phép ảnh jpg/jpeg/png/webp'), false);
      }
      callback(null, true);
    },
    limits: { fileSize: 1024 * 1024 * 4 }, // max 2MB
  });
