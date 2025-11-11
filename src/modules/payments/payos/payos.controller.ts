import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Logger,
  Post,
} from '@nestjs/common';
import { PayosService } from './payos.service';

@Controller('payments/payos')
export class PayosController {
  constructor(private readonly payosService: PayosService) {}
}
