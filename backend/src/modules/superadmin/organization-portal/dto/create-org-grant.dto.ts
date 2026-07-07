import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';
import { GRANT_ROLES, GrantRole } from '../../identity/dto/identity.dto';

export class CreateOrgGrantDto {
  @ApiProperty({ example: 'Anita Sharma' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ example: 'anita@user.test' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    minLength: 8,
    description: 'Required only when creating a brand-new user account.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ enum: GRANT_ROLES })
  @IsEnum(GRANT_ROLES)
  role: GrantRole;
}
