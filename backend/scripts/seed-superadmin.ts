/**
 * Seeds the default superadmin account.
 * Reads SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD from env,
 * falling back to admin@edupro.app / Admin@123456 per CLAUDE.md.
 *
 * Idempotent: if the email already exists, the password is reset.
 */

import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { MasterDataSource } from '../src/database/master-datasource';
import { Superadmin } from '../src/database/master/superadmin.entity';

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL || 'admin@edupro.app';
  const password = process.env.SEED_SUPERADMIN_PASSWORD || 'Admin@123456';
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

  try {
    await MasterDataSource.initialize();
    const repo = MasterDataSource.getRepository(Superadmin);
    const passwordHash = await bcrypt.hash(password, rounds);

    const existing = await repo.findOne({ where: { email } });
    if (existing) {
      await repo.update({ id: existing.id }, { passwordHash, isActive: true });
      console.log(`↻ Reset superadmin password for ${email}`);
    } else {
      const sa = repo.create({
        name: 'Platform Admin',
        email,
        passwordHash,
        role: 'superadmin',
        isActive: true,
      });
      await repo.save(sa);
      console.log(`+ Created superadmin ${email}`);
    }

    await MasterDataSource.destroy();
    console.log('\n✔ Superadmin seeded successfully');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}\n`);
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Failed to seed superadmin:', err);
    process.exit(1);
  }
}

main();
