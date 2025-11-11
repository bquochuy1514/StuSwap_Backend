import { PartialType } from '@nestjs/mapped-types';
import { CreatePayoDto } from './create-payo.dto';

export class UpdatePayoDto extends PartialType(CreatePayoDto) {}
