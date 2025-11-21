import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Package } from './entities/package.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(Package)
    private packagesRepository: Repository<Package>,
  ) {}

  async findAll(packageType?: 'PROMOTION' | 'RENEW' | 'MEMBERSHIP') {
    const query = this.packagesRepository.createQueryBuilder('pkg');

    if (packageType) {
      query.andWhere('pkg.package_type = :packageType', { packageType });
    }

    query.orderBy('pkg.display_name', 'ASC'); // optional

    return await query.getMany();
  }
}
