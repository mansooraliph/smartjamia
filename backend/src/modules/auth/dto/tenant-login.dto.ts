import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class TenantLoginDto {
  @ApiProperty({
    example: 'SUNRISE',
    description: 'School code (uppercase) or slug',
  })
  @IsString()
  schoolCode: string;

  @ApiProperty({ example: 'principal@sunrise.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'OwnerPass@123' })
  @IsString()
  @MinLength(6)
  password: string;
}
