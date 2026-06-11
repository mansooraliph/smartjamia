import { PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export const COURSE_LEVELS = [
  'ug',
  'pg',
  'diploma',
  'phd',
  'certificate',
  'other',
] as const;

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
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}
