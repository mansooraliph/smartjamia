import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '..', '.env') });

import { School } from './master/school.entity';
import { Organization } from './master/organization.entity';
import { OrganizationAdmin } from './master/organization-admin.entity';
import { UserAccount } from './master/user-account.entity';
import { UserLoginActivity } from './master/user-login-activity.entity';
import { SchoolAccessGrant } from './master/school-access-grant.entity';
import { Plan } from './master/plan.entity';
import { Subscription } from './master/subscription.entity';
import { PlatformInvoice } from './master/platform-invoice.entity';
import { Superadmin } from './master/superadmin.entity';
import { SchemaMigrationLog } from './master/schema-migration-log.entity';
import { Branch } from './master/branch.entity';
import { BiometricDevice } from './master/biometric-device.entity';
import { BiometricDeviceCommand } from './master/biometric-device-command.entity';
import { BiometricDeviceLog } from './master/biometric-device-log.entity';
import { ExamBoardInstitution } from './master/exam-board/exam-board-institution.entity';
import { ExamBoardCourse } from './master/exam-board/exam-board-course.entity';
import { ExamBoardAcademicYear } from './master/exam-board/exam-board-academic-year.entity';
import { ExamBoardInstitutionCourse } from './master/exam-board/exam-board-institution-course.entity';
import { ExamBoardInstitutionAcademicYear } from './master/exam-board/exam-board-institution-academic-year.entity';
import { ExamBoardBatch } from './master/exam-board/exam-board-batch.entity';
import { ExamBoardScheme } from './master/exam-board/exam-board-scheme.entity';
import { ExamBoardSubject } from './master/exam-board/exam-board-subject.entity';
import { ExamBoardBatchTermSubject } from './master/exam-board/exam-board-batch-term-subject.entity';
import { ExamBoardSchemeTermSubject } from './master/exam-board/exam-board-scheme-term-subject.entity';
import { ExamBoardSchemeSyllabus } from './master/exam-board/exam-board-scheme-syllabus.entity';

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
    Organization,
    OrganizationAdmin,
    UserAccount,
    UserLoginActivity,
    SchoolAccessGrant,
    Plan,
    Subscription,
    PlatformInvoice,
    Superadmin,
    SchemaMigrationLog,
    Branch,
    BiometricDevice,
    BiometricDeviceCommand,
    BiometricDeviceLog,
    ExamBoardInstitution,
    ExamBoardCourse,
    ExamBoardAcademicYear,
    ExamBoardInstitutionCourse,
    ExamBoardInstitutionAcademicYear,
    ExamBoardBatch,
    ExamBoardScheme,
    ExamBoardSubject,
    ExamBoardBatchTermSubject,
    ExamBoardSchemeTermSubject,
    ExamBoardSchemeSyllabus,
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
