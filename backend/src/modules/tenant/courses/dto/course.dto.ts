import { PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export const COURSE_LEVELS = [
  'higher_secondary',
  'ug',
  'pg',
  'diploma',
  'phd',
  'certificate',
  'other',
] as const;

export const TERM_SYSTEMS = ['annual', 'semester', 'trimester'] as const;

export class CreateCourseDto {
  @IsUUID()
  academicYearId: string;

  @IsIn(COURSE_LEVELS)
  level: (typeof COURSE_LEVELS)[number];

  @IsString()
  @Length(1, 150)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  code?: string;

  @IsOptional()
  @IsIn(TERM_SYSTEMS)
  termSystem?: (typeof TERM_SYSTEMS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  durationYears?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
