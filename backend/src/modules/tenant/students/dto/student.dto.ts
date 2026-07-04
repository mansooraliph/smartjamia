import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export const GENDERS = ['male', 'female', 'other'] as const;
export const STUDENT_STATUSES = [
  'active',
  'inactive',
  'transferred',
  'alumni',
] as const;
export const PARENT_RELATIONS = ['father', 'mother', 'guardian'] as const;

/**
 * Parent/guardian supplied inline with a new student. No studentId — it's the
 * student being created in the same transaction.
 */
export class NestedParentDto {
  @ApiProperty({ enum: PARENT_RELATIONS })
  @IsEnum(PARENT_RELATIONS)
  relation: (typeof PARENT_RELATIONS)[number];

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  phoneCountryCode?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 20)
  phone: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  whatsappCountryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  occupation?: string;

  @ApiPropertyOptional({ description: 'Annual income in rupees' })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualIncome?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 12)
  aadharNumber?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateStudentDto {
  @ApiProperty({ example: 'ADM2026001' })
  @IsString()
  @Length(1, 50)
  admissionNumber: string;

  @ApiProperty({ example: 'Aisha Khan' })
  @IsString()
  @Length(1, 100)
  studentName: string;

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

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  mobileCountryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  mobile?: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  whatsappCountryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  whatsapp?: string;

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

  // ─── Optional inline parents/guardians ────────────────────────────────────
  @ApiPropertyOptional({ type: [NestedParentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NestedParentDto)
  parents?: NestedParentDto[];
}

// Parents are managed separately on edit (via the parents endpoints), so the
// update DTO drops the inline-parents field.
export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @ApiPropertyOptional({ readOnly: true })
  @IsOptional()
  parents?: never;
}

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
