import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export const STAFF_STATUSES = [
  'active',
  'on_leave',
  'resigned',
  'terminated',
] as const;
export const USER_ROLES = [
  'admin',
  'manager',
  'teacher',
  'staff',
  'cashier',
] as const;

export class CreateStaffDto {
  // ── User ──────────────────────────────────────────────────────────────────
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsEnum(USER_ROLES)
  role: (typeof USER_ROLES)[number];

  @ApiPropertyOptional({
    description:
      'Custom role slug — if set, overrides the built-in role for permissions',
  })
  @IsOptional()
  @IsString()
  roleKey?: string | null;

  @ApiPropertyOptional({
    description: 'If omitted, account is created without a password — owner can set later',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  // ── Staff ─────────────────────────────────────────────────────────────────
  @ApiProperty({ example: 'EMP001' })
  @IsString()
  @Length(1, 50)
  employeeId: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  designation: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString()
  joiningDate: string;

  @ApiPropertyOptional({ description: 'Monthly salary in paise' })
  @IsOptional()
  @IsInt()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aadhar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ enum: STAFF_STATUSES, default: 'active' })
  @IsOptional()
  @IsEnum(STAFF_STATUSES)
  status?: (typeof STAFF_STATUSES)[number];
}

export class UpdateStaffDto extends PartialType(CreateStaffDto) {}

export class StaffListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: STAFF_STATUSES })
  @IsOptional()
  @IsEnum(STAFF_STATUSES)
  status?: (typeof STAFF_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ enum: ['xlsx', 'pdf'] })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
}
