import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '..', '.env') });

// Tenant entities
import { User } from './tenant/user.entity';
import { Role } from './tenant/role.entity';
import { SchoolProfile } from './tenant/school-profile.entity';
import { AcademicYear } from './tenant/academic-year.entity';
import { Course } from './tenant/course.entity';
import { ClassEntity } from './tenant/class.entity';
import { Section } from './tenant/section.entity';
import { Subject } from './tenant/subject.entity';
import { Student } from './tenant/student.entity';
import { Parent } from './tenant/parent.entity';
import { StudentQualification } from './tenant/student-qualification.entity';
import { StudentDocument } from './tenant/student-document.entity';
import { StudentEnrollment } from './tenant/student-enrollment.entity';
import { ExamBoardEnrollment } from './tenant/exam-board-enrollment.entity';
import { ExamBoardExam } from './tenant/exam-board-exam.entity';
import { ExamBoardExamSubject } from './tenant/exam-board-exam-subject.entity';
import { ExamBoardMark } from './tenant/exam-board-mark.entity';
import { Attendance } from './tenant/attendance.entity';
import { Exam } from './tenant/exam.entity';
import { ExamSchedule } from './tenant/exam-schedule.entity';
import { Mark } from './tenant/mark.entity';
import { ReportCard } from './tenant/report-card.entity';
import { Promotion } from './tenant/promotion.entity';
import { TransferCertificate } from './tenant/transfer-certificate.entity';
import { FeeHead } from './tenant/fee-head.entity';
import { FeeStructure } from './tenant/fee-structure.entity';
import { Concession } from './tenant/concession.entity';
import { FeeCollection } from './tenant/fee-collection.entity';
import { Payment } from './tenant/payment.entity';
import { Staff } from './tenant/staff.entity';
import { StaffDocument } from './tenant/staff-document.entity';
import { Timetable } from './tenant/timetable.entity';
import { Leave } from './tenant/leave.entity';
import { Announcement } from './tenant/announcement.entity';
import { Notification } from './tenant/notification.entity';
import { LibraryBook } from './tenant/library-book.entity';
import { BookIssue } from './tenant/book-issue.entity';
import { TransportRoute } from './tenant/transport-route.entity';
import { HostelRoom } from './tenant/hostel-room.entity';
import { HostelAllocation } from './tenant/hostel-allocation.entity';
import { InventoryItem } from './tenant/inventory-item.entity';
import { UserInvitation } from './tenant/user-invitation.entity';
import { Visitor } from './tenant/visitor.entity';
import { Visit } from './tenant/visit.entity';
import { BiometricTransaction } from './tenant/biometric-transaction.entity';
import { BiometricEnrollment } from './tenant/biometric-enrollment.entity';

export const TENANT_ENTITIES = [
  User,
  Role,
  SchoolProfile,
  AcademicYear,
  Course,
  ClassEntity,
  Section,
  Subject,
  Student,
  Parent,
  StudentQualification,
  StudentDocument,
  StudentEnrollment,
  ExamBoardEnrollment,
  ExamBoardExam,
  ExamBoardExamSubject,
  ExamBoardMark,
  Attendance,
  Exam,
  ExamSchedule,
  Mark,
  ReportCard,
  Promotion,
  TransferCertificate,
  FeeHead,
  FeeStructure,
  Concession,
  FeeCollection,
  Payment,
  Staff,
  StaffDocument,
  Timetable,
  Leave,
  Announcement,
  Notification,
  LibraryBook,
  BookIssue,
  TransportRoute,
  HostelRoom,
  HostelAllocation,
  InventoryItem,
  UserInvitation,
  Visitor,
  Visit,
  BiometricTransaction,
  BiometricEnrollment,
];

export const dataDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  name: 'data',
  host: process.env.DATA_DB_HOST || 'localhost',
  port: Number(process.env.DATA_DB_PORT || 5438),
  username: process.env.DATA_DB_USER || 'edupro_user',
  password: process.env.DATA_DB_PASS || 'edupro_data_pass',
  database: process.env.DATA_DB_NAME || 'edupro_data',
  // NOTE: no fixed `schema` — multi-tenancy is via search_path. TypeORM emits
  // unqualified table names; the connection defaults to shared_pool (below) and
  // TenantSchemaService.runInSchema overrides search_path per tenant request.
  entities: TENANT_ENTITIES,
  migrations: [join(__dirname, 'migrations', 'tenant', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
  // Pool / connection resilience — avoids ECONNRESET after long idle / NAT reset
  extra: {
    options: '-c search_path=shared_pool,public',
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  },
};

export const DataDataSource = new DataSource(dataDataSourceOptions);
