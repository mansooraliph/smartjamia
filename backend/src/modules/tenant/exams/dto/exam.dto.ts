import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export const EXAM_TYPES = [
  'unit_test',
  'mid_term',
  'final',
  'quarterly',
  'half_yearly',
] as const;
export const EXAM_STATUSES = [
  'draft',
  'scheduled',
  'ongoing',
  'completed',
] as const;

export class CreateExamDto {
  @ApiProperty({ example: 'Mid-Term 1' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ enum: EXAM_TYPES })
  @IsEnum(EXAM_TYPES)
  examType: (typeof EXAM_TYPES)[number];

  @ApiProperty()
  @IsUUID()
  academicYearId: string;

  @ApiProperty()
  @IsUUID()
  classId: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ enum: EXAM_STATUSES, default: 'scheduled' })
  @IsOptional()
  @IsEnum(EXAM_STATUSES)
  status?: (typeof EXAM_STATUSES)[number];
}

export class UpdateExamDto extends PartialType(CreateExamDto) {}

export class ExamListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class MarkEntryDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiPropertyOptional({ description: 'Null/omit if absent' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  marksObtained?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxMarks?: number;
}

export class SaveMarksDto {
  @ApiProperty({ type: [MarkEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  entries: MarkEntryDto[];
}
