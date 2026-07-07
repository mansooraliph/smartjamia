import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
} from 'class-validator';

export const ORGANIZATION_STATUSES = ['active', 'inactive'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Sunrise Education Trust' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ example: 'Ramesh Kumar' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  adminName?: string;

  @ApiProperty({ example: 'ramesh@sunrise.org' })
  @IsEmail()
  adminEmail: string;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  adminPhone?: string;

  @ApiProperty({
    example: 5,
    description: 'Max schools this org may create. -1 = unlimited.',
  })
  @IsInt()
  @Min(-1)
  maxSchoolsAllowed: number;

  @ApiPropertyOptional({ enum: ORGANIZATION_STATUSES, default: 'active' })
  @IsOptional()
  @IsEnum(ORGANIZATION_STATUSES)
  status?: OrganizationStatus;

  @ApiPropertyOptional({
    minLength: 8,
    description:
      'Optional. If set, an organization-admin login (admin email + this ' +
      'password) is created so the org admin can sign in immediately.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;
}
