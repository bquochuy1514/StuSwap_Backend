import { IsEnum, IsOptional } from 'class-validator';

export class GetPackagesQueryDto {
  @IsOptional()
  @IsEnum(['PROMOTION', 'RENEW', 'MEMBERSHIP'], {
    message: 'package_type must be PROMOTION | RENEW | MEMBERSHIP',
  })
  package_type?: 'PROMOTION' | 'RENEW' | 'MEMBERSHIP';
}
