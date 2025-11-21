import { Controller, Get, Query } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { GetPackagesQueryDto } from './dto/get-packages.dto';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  findAll(@Query() query: GetPackagesQueryDto) {
    return this.packagesService.findAll(query.package_type);
  }
}
