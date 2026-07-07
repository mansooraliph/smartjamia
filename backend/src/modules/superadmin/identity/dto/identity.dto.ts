import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, Length, MinLength, IsUUID } from 'class-validator';

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
