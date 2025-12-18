import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { GetPackagesQueryDto } from './dto/get-packages.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  findAll(@Query() query: GetPackagesQueryDto) {
    return this.packagesService.findAll(query.package_type);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOnePackage(@Param('id') id: number) {
    return this.packagesService.findOnePackage(id);
  }
}
