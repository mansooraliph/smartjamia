import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const EXAM_TYPES = [
  'unit_test',
  'mid_term',
  'final',
  'quarterly',
  'half_yearly',
] as const;
const EXAM_STATUSES = ['draft', 'scheduled', 'ongoing', 'completed'] as const;

export class CreateExamBoardExamDto {
  @ApiProperty()
  @IsUUID()
  examBoardBatchId: string;

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

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;
}

export class UpdateExamBoardExamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  termNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ enum: EXAM_TYPES })
  @IsOptional()
  @IsIn(EXAM_TYPES)
  examType?: (typeof EXAM_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: EXAM_STATUSES })
  @IsOptional()
  @IsIn(EXAM_STATUSES)
  status?: (typeof EXAM_STATUSES)[number];
}

export class CreateExamBoardExamSubjectDto {
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

export class UpdateExamBoardExamSubjectDto {
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

class MarkEntryDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsNumber()
  marksObtained: number;

  @ApiPropertyOptional({ description: 'Continuous Evaluation marks obtained' })
  @IsOptional()
  @IsNumber()
  ceMarksObtained?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;
}

export class SaveExamBoardMarksDto {
  @ApiProperty({ type: [MarkEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  marks: MarkEntryDto[];
}
