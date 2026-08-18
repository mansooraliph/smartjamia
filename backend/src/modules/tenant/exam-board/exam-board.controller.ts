import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { TenantExamBoardService } from './exam-board.service';
import { EnrollExamBoardDto } from './dto/enroll.dto';
import {
  CreateExamBoardExamDto,
  CreateExamBoardExamSubjectDto,
  SaveExamBoardMarksDto,
  UpdateExamBoardExamDto,
  UpdateExamBoardExamSubjectDto,
} from './dto/exam.dto';

/**
 * College-side view of the Examination Board — read-only against the org's
 * enabled masters/batches, plus the teacher bulk-enroll action.
 */
@ApiTags('school/exam-board')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school/exam-board')
export class TenantExamBoardController {
  constructor(private readonly svc: TenantExamBoardService) {}

  @Get('courses')
  @RequirePermissions('/exam-board:list')
  @ApiOperation({ summary: 'List courses enabled for this institution' })
  listCourses(@Tenant() t: TenantContext) {
    return this.svc.listCourses(t.schoolId);
  }

  @Get('academic-years')
  @RequirePermissions('/exam-board:list')
  @ApiOperation({ summary: 'List academic years enabled for this institution' })
  listAcademicYears(@Tenant() t: TenantContext) {
    return this.svc.listAcademicYears(t.schoolId);
  }

  @Get('batches')
  @RequirePermissions('/exam-board:list')
  @ApiQuery({ name: 'examBoardCourseId', required: false })
  @ApiQuery({ name: 'examBoardAcademicYearId', required: false })
  @ApiOperation({ summary: 'List batches for this institution' })
  listBatches(
    @Tenant() t: TenantContext,
    @Query('examBoardCourseId') examBoardCourseId?: string,
    @Query('examBoardAcademicYearId') examBoardAcademicYearId?: string,
  ) {
    return this.svc.listBatches(t.schoolId, {
      examBoardCourseId,
      examBoardAcademicYearId,
    });
  }

  @Get('courses/:id/terms')
  @RequirePermissions('/exam-board:list')
  @ApiOperation({ summary: "List a course's Year/Semester/Trimester structure" })
  listCourseTerms(@Param('id') id: string) {
    return this.svc.listCourseTerms(id);
  }

  @Get('batches/:id/terms/:termNumber/subjects')
  @RequirePermissions('/exam-board:list')
  @ApiOperation({ summary: "List a batch's assigned subjects for a term" })
  listAssignedSubjects(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Param('termNumber', ParseIntPipe) termNumber: number,
  ) {
    return this.svc.listAssignedSubjects(t.schoolId, id, termNumber);
  }

  @Get('enrollments')
  @RequirePermissions('/exam-board:list')
  @ApiQuery({ name: 'batchId', required: true })
  @ApiOperation({ summary: 'List students enrolled in a batch' })
  listEnrollments(
    @Tenant() t: TenantContext,
    @Query('batchId') batchId: string,
  ) {
    return this.svc.listEnrollments(t.schemaName, t.schoolId, batchId);
  }

  @Post('enroll')
  @RequirePermissions('/exam-board:create')
  @ApiOperation({ summary: 'Bulk-enroll students into an Exam Board batch' })
  enroll(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Body() dto: EnrollExamBoardDto,
  ) {
    return this.svc.enroll(t.schemaName, t.schoolId, userId, dto);
  }

  // ─── Exams ──────────────────────────────────────────────────────────────────

  @Get('exams')
  @RequirePermissions('/exam-board:list')
  @ApiQuery({ name: 'batchId', required: false })
  @ApiQuery({ name: 'termNumber', required: false })
  @ApiOperation({ summary: 'List Exam Board exams' })
  listExams(
    @Tenant() t: TenantContext,
    @Query('batchId') batchId?: string,
    @Query('termNumber') termNumber?: string,
  ) {
    return this.svc.listExams(
      t.schemaName,
      t.schoolId,
      batchId,
      termNumber ? Number(termNumber) : undefined,
    );
  }

  @Post('exams')
  @RequirePermissions('/exam-board:create')
  @ApiOperation({ summary: 'Schedule an exam for a batch' })
  createExam(@Tenant() t: TenantContext, @Body() dto: CreateExamBoardExamDto) {
    return this.svc.createExam(t.schemaName, t.schoolId, dto);
  }

  @Patch('exams/:id')
  @RequirePermissions('/exam-board:create')
  @ApiOperation({ summary: 'Update an exam' })
  updateExam(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateExamBoardExamDto,
  ) {
    return this.svc.updateExam(t.schemaName, t.schoolId, id, dto);
  }

  @Get('exams/:id/subjects')
  @RequirePermissions('/exam-board:list')
  @ApiOperation({ summary: 'List subjects/papers within an exam' })
  listSubjects(@Tenant() t: TenantContext, @Param('id') id: string) {
    return this.svc.listSubjects(t.schemaName, t.schoolId, id);
  }

  @Post('exams/:id/subjects')
  @RequirePermissions('/exam-board:create')
  @ApiOperation({ summary: 'Add a subject/paper to an exam' })
  addSubject(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Body() dto: CreateExamBoardExamSubjectDto,
  ) {
    return this.svc.addSubject(t.schemaName, t.schoolId, id, dto);
  }

  @Patch('exams/:id/subjects/:subjectId')
  @RequirePermissions('/exam-board:create')
  @ApiOperation({ summary: 'Update a subject/paper (e.g. its date/time)' })
  updateSubject(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateExamBoardExamSubjectDto,
  ) {
    return this.svc.updateSubject(t.schemaName, t.schoolId, id, subjectId, dto);
  }

  @Get('exams/:id/marks')
  @RequirePermissions('/exam-board:list')
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiOperation({ summary: 'List marks for an exam' })
  listMarks(
    @Tenant() t: TenantContext,
    @Param('id') id: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.svc.listMarks(t.schemaName, t.schoolId, id, subjectId);
  }

  @Put('exams/:id/subjects/:subjectId/marks')
  @RequirePermissions('/exam-board:create')
  @ApiOperation({ summary: 'Bulk-save marks for a subject' })
  saveMarks(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: SaveExamBoardMarksDto,
  ) {
    return this.svc.saveMarks(t.schemaName, t.schoolId, id, subjectId, userId, dto);
  }
}
