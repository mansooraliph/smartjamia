/**
 * Sets up the master DB schema and the data DB shared_pool schema.
 *
 *   - Creates extensions (uuid-ossp, pgcrypto)
 *   - Materializes all tables on both connections via TypeORM synchronize
 *   - Ensures `shared_pool` schema exists on the data DB
 *
 * Run via:  npm run db:setup
 */

import 'reflect-metadata';
import { MasterDataSource } from '../src/database/master-datasource';
import { DataDataSource } from '../src/database/data-datasource';

async function setupMaster() {
  console.log('▸ Initializing master DB connection…');
  await MasterDataSource.initialize();
  await MasterDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await MasterDataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  console.log('▸ Synchronizing master DB schema…');
  await MasterDataSource.synchronize(false);
  await MasterDataSource.destroy();
  console.log('✓ Master DB ready');
}

async function setupData() {
  console.log('▸ Initializing data DB connection…');
  await DataDataSource.initialize();
  await DataDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await DataDataSource.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  await DataDataSource.query(`CREATE SCHEMA IF NOT EXISTS "shared_pool";`);

  console.log('▸ Synchronizing data DB shared_pool schema…');
  await DataDataSource.synchronize(false);
  await DataDataSource.destroy();
  console.log('✓ Data DB ready (shared_pool)');
}

async function main() {
  try {
    await setupMaster();
    await setupData();
    console.log('\n✔ Databases setup successful\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Database setup failed:', err);
    process.exit(1);
  }
}

main();
