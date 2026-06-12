import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { AcademicYearsController } from './academic-years/academic-years.controller';
import { AcademicYearsService } from './academic-years/academic-years.service';

import {
  ClassesController,
  SectionsController,
} from './classes/classes.controller';
import { ClassesService } from './classes/classes.service';

import { SubjectsController } from './subjects/subjects.controller';
import { SubjectsService } from './subjects/subjects.service';
import { SubjectImportService } from './subjects/subject-import.service';

import { CoursesController } from './courses/courses.controller';
import { CoursesService } from './courses/courses.service';

import { StudentsController } from './students/students.controller';
import { StudentsService } from './students/students.service';
import { StudentImportService } from './students/student-import.service';

import { ParentsController } from './parents/parents.controller';
import { ParentsService } from './parents/parents.service';
import { ParentImportService } from './parents/parent-import.service';

import { QualificationsController } from './student-profile/qualifications.controller';
import { QualificationsService } from './student-profile/qualifications.service';
import { DocumentsController } from './student-profile/documents.controller';
import { DocumentsService } from './student-profile/documents.service';
import { UploadsController } from './uploads/uploads.controller';

import { AcademicsController } from './academics/academics.controller';
import { AcademicsService } from './academics/academics.service';

import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';

import { PortalController } from './portal/portal.controller';
import { PortalService } from './portal/portal.service';

import { VisitorsController } from './visitors/visitors.controller';
import { VisitorsService } from './visitors/visitors.service';
import { VisitorImportService } from './visitors/visitor-import.service';
import { VisitsController } from './visitors/visits.controller';
import { VisitsService } from './visitors/visits.service';

import { StaffController } from './staff/staff.controller';
import { StaffService } from './staff/staff.service';
import { StaffImportService } from './staff/staff-import.service';
import { StaffDocumentsController } from './staff/staff-documents.controller';
import { StaffDocumentsService } from './staff/staff-documents.service';

import { SchoolStatsController } from './stats/school-stats.controller';
import { SchoolStatsService } from './stats/school-stats.service';

import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';

import { ExamsController } from './exams/exams.controller';
import { ExamsService } from './exams/exams.service';

import { TimetableController } from './timetable/timetable.controller';
import { TimetableService } from './timetable/timetable.service';

import { ReportCardsController } from './report-cards/report-cards.controller';
import { ReportCardsService } from './report-cards/report-cards.service';
import { ReportCardsProcessor } from './report-cards/report-cards.processor';

import { RolesController } from './roles/roles.controller';
import { RolesService } from './roles/roles.service';

import { TransferCertificatesController } from './transfer-certificates/transfer-certificates.controller';
import { TransferCertificatesService } from './transfer-certificates/transfer-certificates.service';
import { TransferCertificatesProcessor } from './transfer-certificates/transfer-certificates.processor';
import { REPORTS_QUEUE } from './transfer-certificates/tc.constants';

import { TenantJwtGuard } from '../../common/guards/tenant-jwt.guard';

@Module({
  imports: [BullModule.registerQueue({ name: REPORTS_QUEUE })],
  controllers: [
    AcademicYearsController,
    ClassesController,
    CoursesController,
    SectionsController,
    SubjectsController,
    StudentsController,
    ParentsController,
    QualificationsController,
    DocumentsController,
    UploadsController,
    StaffDocumentsController,
    AcademicsController,
    SettingsController,
    VisitorsController,
    VisitsController,
    PortalController,
    StaffController,
    AttendanceController,
    ExamsController,
    TimetableController,
    ReportCardsController,
    RolesController,
    TransferCertificatesController,
    SchoolStatsController,
  ],
  providers: [
    AcademicYearsService,
    ClassesService,
    CoursesService,
    SubjectsService,
    SubjectImportService,
    StudentsService,
    StudentImportService,
    ParentsService,
    ParentImportService,
    QualificationsService,
    DocumentsService,
    AcademicsService,
    SettingsService,
    VisitorsService,
    VisitorImportService,
    VisitsService,
    PortalService,
    StaffService,
    StaffImportService,
    StaffDocumentsService,
    AttendanceService,
    ExamsService,
    TimetableService,
    ReportCardsService,
    ReportCardsProcessor,
    RolesService,
    TransferCertificatesService,
    TransferCertificatesProcessor,
    SchoolStatsService,
    TenantJwtGuard,
  ],
})
export class SchoolModule {}
