import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const GRANT_ROLES = [
  'owner',
  'admin',
  'manager',
  'teacher',
  'staff',
  'cashier',
] as const;
export type GrantRole = (typeof GRANT_ROLES)[number];

export class CreateUserAccountDto {
  @ApiProperty({ example: 'Priya Coordinator' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ example: 'priya@trust.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class CreateGrantDto {
  @ApiProperty({ description: 'School to grant access to.' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ enum: GRANT_ROLES, description: 'Role within this school.' })
  @IsEnum(GRANT_ROLES)
  role: GrantRole;
}

class GrantAssignmentDto {
  @ApiProperty({ description: 'School to grant access to.' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ enum: GRANT_ROLES, description: 'Role within this school.' })
  @IsEnum(GRANT_ROLES)
  role: GrantRole;
}

export class CreateOrgUserDto {
  @ApiProperty({ example: 'Priya Coordinator' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ example: 'priya@trust.org' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    minLength: 8,
    description: 'Required only if the email has no existing account.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ type: [GrantAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrantAssignmentDto)
  grants: GrantAssignmentDto[];
}

export class ResetPasswordDto {
  @ApiPropertyOptional({
    minLength: 8,
    description: 'Omit to auto-generate a temporary password.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class CreateOrganizationAdminDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ example: 'ramesh@sunrise.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
