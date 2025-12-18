// src/common/interceptors/transform-image-url.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TransformImageUrlInterceptor implements NestInterceptor {
  constructor(private configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return this.transformImageUrls(data);
      }),
    );
  }

  private transformImageUrls(data: any): any {
    if (!data) return data;

    const baseUrl = this.configService.get('APP_URL');

    // Xử lý array
    if (Array.isArray(data)) {
      return data.map((item) => this.transformImageUrls(item));
    }

    // CRITICAL: Không transform Date, Buffer, và các built-in types
    if (
      data instanceof Date ||
      data instanceof Buffer ||
      data instanceof RegExp ||
      typeof data === 'function'
    ) {
      return data;
    }

    // Xử lý object
    if (typeof data === 'object') {
      const transformed = { ...data };

      // Transform image_urls (string JSON)
      if (
        transformed.image_urls &&
        typeof transformed.image_urls === 'string'
      ) {
        try {
          const urls = JSON.parse(transformed.image_urls);
          transformed.image_urls = JSON.stringify(
            urls.map((url: string) =>
              url.startsWith('http') ? url : `${baseUrl}${url}`,
            ),
          );
        } catch (error) {
          // Keep original if parse fails
        }
      }

      // Transform category icon_url
      if (
        transformed.category?.icon_url &&
        !transformed.category.icon_url.startsWith('http')
      ) {
        transformed.category.icon_url = `${baseUrl}${transformed.category.icon_url}`;
      }

      // Recursively transform nested objects
      Object.keys(transformed).forEach((key) => {
        if (typeof transformed[key] === 'object') {
          transformed[key] = this.transformImageUrls(transformed[key]);
        }
      });

      return transformed;
    }

    return data;
  }
}
