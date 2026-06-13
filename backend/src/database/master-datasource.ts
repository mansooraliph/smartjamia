import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '..', '.env') });

import { School } from './master/school.entity';
import { Plan } from './master/plan.entity';
import { Subscription } from './master/subscription.entity';
import { PlatformInvoice } from './master/platform-invoice.entity';
import { Superadmin } from './master/superadmin.entity';
import { SchemaMigrationLog } from './master/schema-migration-log.entity';
import { Branch } from './master/branch.entity';
import { BiometricDevice } from './master/biometric-device.entity';
import { BiometricDeviceCommand } from './master/biometric-device-command.entity';
import { BiometricDeviceLog } from './master/biometric-device-log.entity';

export const masterDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  name: 'master',
  host: process.env.MASTER_DB_HOST || 'localhost',
  port: Number(process.env.MASTER_DB_PORT || 5437),
  username: process.env.MASTER_DB_USER || 'edupro_user',
  password: process.env.MASTER_DB_PASS || 'edupro_master_pass',
  database: process.env.MASTER_DB_NAME || 'edupro_master',
  entities: [
    School,
    Plan,
    Subscription,
    PlatformInvoice,
    Superadmin,
    SchemaMigrationLog,
    Branch,
    BiometricDevice,
    BiometricDeviceCommand,
    BiometricDeviceLog,
  ],
  migrations: [join(__dirname, 'migrations', 'master', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
  // Pool / connection resilience — avoids ECONNRESET after long idle / NAT reset
  extra: {
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  },
};

export const MasterDataSource = new DataSource(masterDataSourceOptions);
