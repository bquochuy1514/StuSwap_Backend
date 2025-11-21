import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import { Package } from '../../../modules/packages/entities/package.entity';
import {
  promotionPackages,
  // renewPackages,
  // membershipPackages,
} from '../data/index';

export default class PackageSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    const repository = dataSource.getRepository(Package);

    console.log('🌱 Seeding packages...\n');

    // Seed Promotion Packages
    await this.seedPackageType(
      repository,
      promotionPackages,
      'PROMOTION',
      '📣',
    );

    // Seed Renew Packages
    // await this.seedPackageType(repository, renewPackages, 'RENEW', '🔄');

    // Seed Membership Packages
    // await this.seedPackageType(
    //   repository,
    //   membershipPackages,
    //   'MEMBERSHIP',
    //   '👑',
    // );

    console.log('\n✅ All packages seeded successfully!');
  }

  private async seedPackageType(
    repository: any,
    packages: any[],
    type: string,
    emoji: string,
  ): Promise<void> {
    console.log(`${emoji} Seeding ${type} packages...`);

    for (const packageData of packages) {
      const existing = await repository.findOne({
        where: { key: packageData.key },
      });

      if (!existing) {
        const newPackage = repository.create(packageData);
        await repository.save(newPackage);
        console.log(`  ✓ Created: ${packageData.display_name}`);
      } else {
        // Optional: Update existing package
        await repository.update({ key: packageData.key }, packageData);
        console.log(`  ↻ Updated: ${packageData.display_name}`);
      }
    }
  }
}
