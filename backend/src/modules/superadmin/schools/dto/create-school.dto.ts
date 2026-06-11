import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export const SCHOOL_STATUSES = [
  'trial',
  'active',
  'grace_period',
  'suspended',
  'cancelled',
] as const;
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];

export class CreateSchoolDto {
  @ApiProperty({ example: 'Sunrise Public School' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    example: 'SUNRISE',
    description:
      'Short uppercase code that school users type to log in. Auto-generated from name if omitted.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{0,49}$/, {
    message: 'code must be uppercase alphanumeric (- allowed), 1-50 chars',
  })
  code?: string;

  @ApiPropertyOptional({
    example: 'sunrise-public-school',
    description: 'URL slug. Auto-generated from name if omitted.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{0,99}$/, {
    message: 'slug must be lowercase, kebab-case',
  })
  slug?: string;

  @ApiProperty({ example: 'principal@sunrise.edu' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiPropertyOptional({ enum: SCHOOL_STATUSES, default: 'trial' })
  @IsOptional()
  @IsEnum(SCHOOL_STATUSES)
  status?: SchoolStatus;

  // ─── Owner (school admin) ─────────────────────────────────────────────────
  @ApiPropertyOptional({
    description:
      'Owner full name. If ownerName + ownerEmail + ownerPassword are provided, an owner user is created in the tenant schema.',
  })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  ownerPassword?: string;
}
