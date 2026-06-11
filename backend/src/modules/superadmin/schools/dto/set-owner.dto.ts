import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Update (or create) a school's admin/owner from the superadmin console.
 * All fields optional when an owner already exists (e.g. password-only reset);
 * when no owner exists yet, name + email + password are all required.
 */
export class SetOwnerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72)
  password?: string;
}
