import { Module } from '@nestjs/common';
import { VnpayService } from './vnpay.service';
import { VnpayController } from './vnpay.controller';
import { ignoreLogger } from 'vnpay';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VnpayModule as VnpayLibModule } from 'nestjs-vnpay';

@Module({
  imports: [
    VnpayLibModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secureSecret: configService.getOrThrow<string>('VNP_HASH_SECRET'),
        tmnCode: configService.getOrThrow<string>('VNP_TMN_CODE'),
        vnpayHost: configService.get<string>('VNP_URL'),
        testMode: true,
        enableLog: true,
        loggerFn: ignoreLogger,
        vnp_Version: '2.1.0', // 👈 thêm dòng này
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [VnpayController],
  providers: [VnpayService],
})
export class VnpayModule {}
