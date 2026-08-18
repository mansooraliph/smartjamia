import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { ExamBoardService } from './exam-board.service';
import { ExamBoardSubjectImportService } from './exam-board-subject-import.service';
import {
  CopyBatchConfigDto,
  CopySchemeConfigDto,
  CreateBatchExamDto,
  CreateBatchExamSubjectDto,
  UpdateBatchExamSubjectDto,
  CreateExamBoardAcademicYearDto,
  CreateExamBoardBatchDto,
  CreateExamBoardCourseDto,
  CreateExamBoardSchemeDto,
  CreateExamBoardSubjectDto,
  SetBatchTermSubjectsDto,
  SetInstitutionEnablementDto,
  UpdateExamBoardAcademicYearDto,
  UpdateExamBoardBatchDto,
  UpdateExamBoardCourseDto,
  UpdateExamBoardSchemeDto,
  UpdateExamBoardSubjectDto,
} from './dto/exam-board.dto';

/**
 * Examination Board wing of the Organization Admin portal. Org-scoped:
 * courses/academic-years are a master catalog the org maintains, enabled
 * per-institution (college), with batches created per institution+course+year.
 */
@ApiTags('org-portal/exam-board')
@ApiBearerAuth('bearer')
@UseGuards(OrganizationGuard)
@Controller('org/exam-board')
export class ExamBoardController {
  constructor(
    private readonly svc: ExamBoardService,
    private readonly subjectImporter: ExamBoardSubjectImportService,
  ) {}

  private orgId(req: Request): string {
    return (req as any).user.organizationId;
  }

  // ─── Institutions ─────────────────────────────────────────────────────────
  @Get('institutions')
  @ApiOperation({ summary: "List the organization's institutions" })
  listInstitutions(@Req() req: Request) {
    return this.svc.listInstitutions(this.orgId(req));
  }

  @Put('institutions/:schoolId')
  @ApiOperation({
    summary: 'Copy a school into the Exam Board wing (enable/disable)',
  })
  setInstitutionEnabled(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
    @Body() dto: SetInstitutionEnablementDto,
  ) {
    return this.svc.setInstitutionEnabled(
      this.orgId(req),
      schoolId,
      dto.isEnabled,
    );
  }

  // ─── Course master ──────────────────────────────────────────────────────
  @Get('courses')
  @ApiOperation({ summary: 'List the org course master' })
  listCourses(@Req() req: Request) {
    return this.svc.listCourses(this.orgId(req));
  }

  @Post('courses')
  @ApiOperation({ summary: 'Create a course in the org master' })
  createCourse(@Req() req: Request, @Body() dto: CreateExamBoardCourseDto) {
    return this.svc.createCourse(this.orgId(req), dto);
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'Update a course in the org master' })
  updateCourse(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateExamBoardCourseDto,
  ) {
    return this.svc.updateCourse(this.orgId(req), id, dto);
  }

  @Delete('courses/:id')
  @ApiOperation({ summary: 'Delete a course (fails if any batch uses it)' })
  removeCourse(@Req() req: Request, @Param('id') id: string) {
    return this.svc.removeCourse(this.orgId(req), id);
  }

  @Get('courses/:id/terms')
  @ApiOperation({ summary: 'List a course\'s Year/Semester/Trimester structure' })
  listCourseTerms(@Req() req: Request, @Param('id') id: string) {
    return this.svc.listCourseTerms(this.orgId(req), id);
  }

  // ─── Schemes ────────────────────────────────────────────────────────────
  @Get('schemes')
  @ApiQuery({ name: 'examBoardCourseId', required: false })
  @ApiOperation({ summary: 'List schemes (optionally filtered by course)' })
  listSchemes(
    @Req() req: Request,
    @Query('examBoardCourseId') examBoardCourseId?: string,
  ) {
    return this.svc.listSchemes(this.orgId(req), examBoardCourseId);
  }

  @Post('schemes')
  @ApiOperation({ summary: 'Create a scheme under a course' })
  createScheme(@Req() req: Request, @Body() dto: CreateExamBoardSchemeDto) {
    return this.svc.createScheme(this.orgId(req), dto);
  }

  @Patch('schemes/:id')
  @ApiOperation({ summary: 'Update a scheme' })
  updateScheme(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateExamBoardSchemeDto,
  ) {
    return this.svc.updateScheme(this.orgId(req), id, dto);
  }

  @Delete('schemes/:id')
  @ApiOperation({ summary: 'Delete a scheme (fails if any batch uses it)' })
  removeScheme(@Req() req: Request, @Param('id') id: string) {
    return this.svc.removeScheme(this.orgId(req), id);
  }

  @Get('schemes/:id/terms/:termNumber/subjects')
  @ApiOperation({ summary: 'List subjects with assignment status for a scheme term' })
  listSchemeTermSubjects(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('termNumber', ParseIntPipe) termNumber: number,
  ) {
    return this.svc.listSchemeTermSubjects(this.orgId(req), id, termNumber);
  }

  @Put('schemes/:id/terms/:termNumber/subjects')
  @ApiOperation({ summary: 'Set the subjects assigned to a scheme term' })
  setSchemeTermSubjects(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('termNumber', ParseIntPipe) termNumber: number,
    @Body() dto: SetBatchTermSubjectsDto,
  ) {
    return this.svc.setSchemeTermSubjects(this.orgId(req), id, termNumber, dto);
  }

  @Post('schemes/:id/copy-config')
  @ApiOperation({ summary: 'Copy every term\'s subject assignments from another scheme' })
  copySchemeConfig(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CopySchemeConfigDto,
  ) {
    return this.svc.copySchemeConfig(this.orgId(req), id, dto);
  }

  @Get('schemes/:id/syllabus')
  @ApiOperation({ summary: 'List syllabus PDFs uploaded for a scheme (one per term)' })
  listSchemeSyllabi(@Req() req: Request, @Param('id') id: string) {
    return this.svc.listSchemeSyllabi(this.orgId(req), id);
  }

  @Post('schemes/:id/terms/:termNumber/syllabus')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload (or replace) the syllabus PDF for a scheme term' })
  uploadSchemeSyllabus(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('termNumber', ParseIntPipe) termNumber: number,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.uploadSchemeSyllabus(this.orgId(req), id, termNumber, file);
  }

  @Delete('schemes/:id/terms/:termNumber/syllabus')
  @ApiOperation({ summary: 'Remove the syllabus PDF for a scheme term' })
  removeSchemeSyllabus(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('termNumber', ParseIntPipe) termNumber: number,
  ) {
    return this.svc.removeSchemeSyllabus(this.orgId(req), id, termNumber);
  }

  // ─── Subjects ───────────────────────────────────────────────────────────
  @Get('subjects/import/template')
  @ApiOperation({ summary: 'Download the subject import template (.xlsx)' })
  async importSubjectsTemplate(@Res() res: Response) {
    const buf = await this.subjectImporter.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="exam-board-subject-import-template.xlsx"',
    );
    res.end(buf);
  }

  @Post('subjects/import/preview')
  @ApiQuery({ name: 'examBoardCourseId', required: true })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate a subject import file without saving' })
  importSubjectsPreview(
    @Req() req: Request,
    @UploadedFile() file: { buffer: Buffer },
    @Query('examBoardCourseId') examBoardCourseId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.subjectImporter.preview(this.orgId(req), examBoardCourseId, file.buffer);
  }

  @Post('subjects/import/commit')
  @ApiQuery({ name: 'examBoardCourseId', required: true })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import valid rows from a subject import file' })
  importSubjectsCommit(
    @Req() req: Request,
    @UploadedFile() file: { buffer: Buffer },
    @Query('examBoardCourseId') examBoardCourseId: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.subjectImporter.commit(this.orgId(req), examBoardCourseId, file.buffer);
  }

  @Get('subjects')
  @ApiQuery({ name: 'examBoardCourseId', required: false })
  @ApiQuery({ name: 'termNumber', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiOperation({ summary: 'List subjects (paginated, optionally filtered by course/term/search)' })
  listSubjects(
    @Req() req: Request,
    @Query('examBoardCourseId') examBoardCourseId?: string,
    @Query('termNumber') termNumber?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.listSubjectsPaginated(this.orgId(req), {
      examBoardCourseId,
      termNumber: termNumber ? Number(termNumber) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Post('subjects')
  @ApiOperation({ summary: 'Create a subject under a course + term' })
  createSubject(@Req() req: Request, @Body() dto: CreateExamBoardSubjectDto) {
    return this.svc.createSubject(this.orgId(req), dto);
  }

  @Patch('subjects/:id')
  @ApiOperation({ summary: 'Update a subject' })
  updateSubject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateExamBoardSubjectDto,
  ) {
    return this.svc.updateSubject(this.orgId(req), id, dto);
  }

  @Delete('subjects/:id')
  @ApiOperation({ summary: 'Delete a subject' })
  removeSubject(@Req() req: Request, @Param('id') id: string) {
    return this.svc.removeSubject(this.orgId(req), id);
  }

  // ─── Academic year master ──────────────────────────────────────────────
  @Get('academic-years')
  @ApiOperation({ summary: 'List the org academic year master' })
  listAcademicYears(@Req() req: Request) {
    return this.svc.listAcademicYears(this.orgId(req));
  }

  @Post('academic-years')
  @ApiOperation({ summary: 'Create an academic year in the org master' })
  createAcademicYear(
    @Req() req: Request,
    @Body() dto: CreateExamBoardAcademicYearDto,
  ) {
    return this.svc.createAcademicYear(this.orgId(req), dto);
  }

  @Patch('academic-years/:id')
  @ApiOperation({ summary: 'Update an academic year in the org master' })
  updateAcademicYear(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateExamBoardAcademicYearDto,
  ) {
    return this.svc.updateAcademicYear(this.orgId(req), id, dto);
  }

  @Delete('academic-years/:id')
  @ApiOperation({ summary: 'Delete an academic year (fails if any batch uses it)' })
  removeAcademicYear(@Req() req: Request, @Param('id') id: string) {
    return this.svc.removeAcademicYear(this.orgId(req), id);
  }

  @Patch('academic-years/:id/set-current')
  @ApiOperation({ summary: 'Mark an academic year as current' })
  setCurrentAcademicYear(@Req() req: Request, @Param('id') id: string) {
    return this.svc.setCurrentAcademicYear(this.orgId(req), id);
  }

  // ─── Per-institution enablement ─────────────────────────────────────────
  @Get('institutions/:schoolId/courses')
  @ApiOperation({ summary: 'List courses with enablement status for an institution' })
  listInstitutionCourses(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
  ) {
    return this.svc.listInstitutionCourses(this.orgId(req), schoolId);
  }

  @Put('institutions/:schoolId/courses/:courseId')
  @ApiOperation({ summary: 'Enable/disable a course for an institution' })
  setInstitutionCourse(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
    @Param('courseId') courseId: string,
    @Body() dto: SetInstitutionEnablementDto,
  ) {
    return this.svc.setInstitutionCourse(
      this.orgId(req),
      schoolId,
      courseId,
      dto,
    );
  }

  @Get('institutions/:schoolId/academic-years')
  @ApiOperation({
    summary: 'List academic years with enablement status for an institution',
  })
  listInstitutionAcademicYears(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
  ) {
    return this.svc.listInstitutionAcademicYears(this.orgId(req), schoolId);
  }

  @Put('institutions/:schoolId/academic-years/:yearId')
  @ApiOperation({ summary: 'Enable/disable an academic year for an institution' })
  setInstitutionAcademicYear(
    @Req() req: Request,
    @Param('schoolId') schoolId: string,
    @Param('yearId') yearId: string,
    @Body() dto: SetInstitutionEnablementDto,
  ) {
    return this.svc.setInstitutionAcademicYear(
      this.orgId(req),
      schoolId,
      yearId,
      dto,
    );
  }

  // ─── Batches ──────────────────────────────────────────────────────────────
  @Get('batches')
  @ApiOperation({ summary: 'List batches (optionally filtered)' })
  listBatches(
    @Req() req: Request,
    @Query('schoolId') schoolId?: string,
    @Query('examBoardCourseId') examBoardCourseId?: string,
    @Query('examBoardAcademicYearId') examBoardAcademicYearId?: string,
  ) {
    return this.svc.listBatches(this.orgId(req), {
      schoolId,
      examBoardCourseId,
      examBoardAcademicYearId,
    });
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get a single batch' })
  getBatch(@Req() req: Request, @Param('id') id: string) {
    return this.svc.getBatch(this.orgId(req), id);
  }

  @Get('batches/:id/enrollments')
  @ApiOperation({ summary: 'List students enrolled in a batch' })
  listBatchEnrollments(@Req() req: Request, @Param('id') id: string) {
    return this.svc.listBatchEnrollments(this.orgId(req), id);
  }

  @Get('batches/:id/exams')
  @ApiOperation({ summary: 'List exams scheduled for a batch' })
  listBatchExams(@Req() req: Request, @Param('id') id: string) {
    return this.svc.listBatchExams(this.orgId(req), id);
  }

  @Get('batches/:id/exams/:examId/subjects')
  @ApiOperation({ summary: 'List subject-wise schedule within an exam' })
  listBatchExamSubjects(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('examId') examId: string,
  ) {
    return this.svc.listBatchExamSubjects(this.orgId(req), id, examId);
  }

  @Post('batches/:id/exams')
  @ApiOperation({ summary: 'Schedule an exam for a batch' })
  createBatchExam(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateBatchExamDto,
  ) {
    return this.svc.createBatchExam(this.orgId(req), id, dto);
  }

  @Post('batches/:id/exams/:examId/subjects')
  @ApiOperation({ summary: 'Add a subject/paper (with date + time) to a batch exam' })
  addBatchExamSubject(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('examId') examId: string,
    @Body() dto: CreateBatchExamSubjectDto,
  ) {
    return this.svc.addBatchExamSubject(this.orgId(req), id, examId, dto);
  }

  @Patch('batches/:id/exams/:examId/subjects/:subjectId')
  @ApiOperation({ summary: 'Update a subject/paper within a batch exam (e.g. its date/time)' })
  updateBatchExamSubject(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('examId') examId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateBatchExamSubjectDto,
  ) {
    return this.svc.updateBatchExamSubject(this.orgId(req), id, examId, subjectId, dto);
  }

  @Post('batches')
  @ApiOperation({ summary: 'Create a batch for an institution+course+year' })
  createBatch(@Req() req: Request, @Body() dto: CreateExamBoardBatchDto) {
    return this.svc.createBatch(this.orgId(req), dto);
  }

  @Patch('batches/:id')
  @ApiOperation({ summary: 'Update a batch' })
  updateBatch(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateExamBoardBatchDto,
  ) {
    return this.svc.updateBatch(this.orgId(req), id, dto);
  }

  @Delete('batches/:id')
  @ApiOperation({ summary: 'Delete a batch' })
  removeBatch(@Req() req: Request, @Param('id') id: string) {
    return this.svc.removeBatch(this.orgId(req), id);
  }

  @Get('batches/:id/terms/:termNumber/subjects')
  @ApiOperation({ summary: 'List subjects with assignment status for a batch term' })
  listBatchTermSubjects(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('termNumber', ParseIntPipe) termNumber: number,
  ) {
    return this.svc.listBatchTermSubjects(this.orgId(req), id, termNumber);
  }

  @Put('batches/:id/terms/:termNumber/subjects')
  @ApiOperation({ summary: 'Set the subjects assigned to a batch term' })
  setBatchTermSubjects(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('termNumber', ParseIntPipe) termNumber: number,
    @Body() dto: SetBatchTermSubjectsDto,
  ) {
    return this.svc.setBatchTermSubjects(this.orgId(req), id, termNumber, dto);
  }

  @Post('batches/:id/copy-config')
  @ApiOperation({
    summary: "Copy a source batch's scheme + term-subject assignments into this batch",
  })
  copyBatchConfig(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CopyBatchConfigDto,
  ) {
    return this.svc.copyBatchConfig(this.orgId(req), id, dto);
  }
}
