import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

const COURSE_LEVELS = [
  'higher_secondary',
  'ug',
  'pg',
  'diploma',
  'phd',
  'certificate',
  'other',
] as const;
const TERM_SYSTEMS = ['annual', 'semester', 'trimester'] as const;

export class CreateExamBoardCourseDto {
  @ApiProperty({ example: 'B.Sc Computer Science' })
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: 'BSC-CS' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @ApiPropertyOptional({ enum: COURSE_LEVELS, default: 'ug' })
  @IsOptional()
  @IsIn(COURSE_LEVELS)
  level?: (typeof COURSE_LEVELS)[number];

  @ApiPropertyOptional({ enum: TERM_SYSTEMS, default: 'annual' })
  @IsOptional()
  @IsIn(TERM_SYSTEMS)
  termSystem?: (typeof TERM_SYSTEMS)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationYears?: number;
}

export class UpdateExamBoardCourseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @ApiPropertyOptional({ enum: COURSE_LEVELS })
  @IsOptional()
  @IsIn(COURSE_LEVELS)
  level?: (typeof COURSE_LEVELS)[number];

  @ApiPropertyOptional({ enum: TERM_SYSTEMS })
  @IsOptional()
  @IsIn(TERM_SYSTEMS)
  termSystem?: (typeof TERM_SYSTEMS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationYears?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExamBoardAcademicYearDto {
  @ApiProperty({ example: '2026-27' })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-05-31' })
  @IsDateString()
  endDate: string;
}

export class UpdateExamBoardAcademicYearDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExamBoardSchemeDto {
  @ApiProperty()
  @IsUUID()
  examBoardCourseId: string;

  @ApiPropertyOptional({ description: 'Academic year this scheme first takes effect from' })
  @IsOptional()
  @IsUUID()
  startingAcademicYearId?: string;

  @ApiProperty({ example: '2026 Scheme' })
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: 'SCH-2026' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;
}

export class UpdateExamBoardSchemeDto {
  @ApiPropertyOptional({ description: 'Academic year this scheme first takes effect from' })
  @IsOptional()
  @IsUUID()
  startingAcademicYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateExamBoardSubjectDto {
  @ApiProperty()
  @IsUUID()
  examBoardCourseId: string;

  @ApiProperty({ example: 1, description: 'Year/Semester/Trimester number within the course' })
  @IsInt()
  @Min(1)
  termNumber: number;

  @ApiProperty({ example: 'Data Structures' })
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiPropertyOptional({ example: 'هياكل البيانات' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  nameArabic?: string;

  @ApiPropertyOptional({ example: 'CS101' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMarks?: number;

  @ApiPropertyOptional({ default: 35 })
  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation max marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ceMaxMarks?: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation pass marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cePassMarks?: number;
}

export class UpdateExamBoardSubjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  termNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  nameArabic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMarks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation max marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ceMaxMarks?: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation pass marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cePassMarks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetBatchTermSubjectsDto {
  @ApiProperty({ type: [String], description: 'Subject ids assigned to this term' })
  @IsArray()
  @IsUUID('4', { each: true })
  examBoardSubjectIds: string[];
}

export class CopyBatchConfigDto {
  @ApiProperty({ description: 'Batch to copy scheme + term-subject assignments from' })
  @IsUUID()
  sourceBatchId: string;
}

export class CopySchemeConfigDto {
  @ApiProperty({ description: 'Scheme to copy every term\'s subject assignments from' })
  @IsUUID()
  sourceSchemeId: string;
}

export class SetInstitutionEnablementDto {
  @ApiProperty()
  @IsBoolean()
  isEnabled: boolean;
}

export class ImportInstitutionCoursesDto {
  @ApiProperty({ type: [String], description: "Ids of the institution's local courses to copy into the Exam Board course master" })
  @IsArray()
  @IsUUID('4', { each: true })
  courseIds: string[];
}

export class CreateExamBoardBatchDto {
  @ApiProperty({ description: 'Institution (college) this batch belongs to' })
  @IsUUID()
  schoolId: string;

  @ApiProperty()
  @IsUUID()
  examBoardCourseId: string;

  @ApiProperty()
  @IsUUID()
  examBoardAcademicYearId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  examBoardSchemeId?: string;

  @ApiProperty({ example: 'B.Sc CS 2026-27 Batch A' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ default: 1, description: 'The Year/Semester/Trimester this batch is currently running' })
  @IsOptional()
  @IsInt()
  @Min(1)
  currentTermNumber?: number;
}

export class UpdateExamBoardBatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  examBoardSchemeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ description: 'The Year/Semester/Trimester this batch is currently running' })
  @IsOptional()
  @IsInt()
  @Min(1)
  currentTermNumber?: number;

  @ApiPropertyOptional({ enum: ['active', 'closed'] })
  @IsOptional()
  @IsIn(['active', 'closed'])
  status?: 'active' | 'closed';
}

// ─── Batch exam scheduling (org admin can schedule on a college's behalf) ───

const EXAM_TYPES = ['unit_test', 'mid_term', 'final', 'quarterly', 'half_yearly'] as const;
const EXAM_CATEGORIES = ['regular', 'supplementary'] as const;
const EXAM_STATUSES = ['draft', 'scheduled', 'ongoing', 'completed'] as const;

export class CreateBatchExamDto {
  @ApiProperty({ example: 1, description: 'Year/Semester/Trimester number within the course' })
  @IsInt()
  @Min(1)
  termNumber: number;

  @ApiProperty({ example: 'Semester 1 Final' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ enum: EXAM_TYPES })
  @IsIn(EXAM_TYPES)
  examType: (typeof EXAM_TYPES)[number];

  @ApiPropertyOptional({ enum: EXAM_CATEGORIES, default: 'regular' })
  @IsOptional()
  @IsIn(EXAM_CATEGORIES)
  examCategory?: (typeof EXAM_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: EXAM_STATUSES, default: 'scheduled' })
  @IsOptional()
  @IsIn(EXAM_STATUSES)
  status?: (typeof EXAM_STATUSES)[number];

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;
}

export class CreateBatchExamSubjectDto {
  @ApiProperty({ example: 'Data Structures' })
  @IsString()
  @Length(1, 100)
  subjectName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '10:00', description: 'Start time (HH:mm)' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: 'time must be in HH:mm format' })
  time?: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  maxMarks: number;

  @ApiProperty({ example: 35 })
  @IsInt()
  @Min(0)
  passMarks: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation max marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ceMaxMarks?: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation pass marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cePassMarks?: number;
}

export class UpdateBatchExamSubjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '10:00', description: 'Start time (HH:mm)' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: 'time must be in HH:mm format' })
  time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMarks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation max marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  ceMaxMarks?: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation pass marks' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cePassMarks?: number;
}
