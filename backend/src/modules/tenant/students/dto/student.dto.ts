import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export const GENDERS = ['male', 'female', 'other'] as const;
export const STUDENT_STATUSES = [
  'active',
  'inactive',
  'transferred',
  'alumni',
] as const;

export class CreateStudentDto {
  @ApiProperty({ example: 'ADM2026001' })
  @IsString()
  @Length(1, 50)
  admissionNumber: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  lastName: string;

  @ApiProperty({ example: '2015-08-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: GENDERS })
  @IsEnum(GENDERS)
  gender: (typeof GENDERS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  religion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  caste?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aadharNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previousSchool?: string;

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  admissionDate: string;

  @ApiPropertyOptional({ enum: STUDENT_STATUSES, default: 'active' })
  @IsOptional()
  @IsEnum(STUDENT_STATUSES)
  status?: (typeof STUDENT_STATUSES)[number];

  // ─── Optional enrollment ──────────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollNumber?: string;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

export class StudentListQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ enum: STUDENT_STATUSES })
  @IsOptional()
  @IsEnum(STUDENT_STATUSES)
  status?: (typeof STUDENT_STATUSES)[number];

  @ApiPropertyOptional({ enum: ['xlsx', 'pdf'] })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
}
