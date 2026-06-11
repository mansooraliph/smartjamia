import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class StudentLoginDto {
  @ApiProperty({ example: 'CTP' })
  @IsString()
  schoolCode: string;

  @ApiProperty({ example: 'ADM2026001' })
  @IsString()
  admissionNumber: string;

  @ApiProperty({ example: '1234', description: '4–6 digit PIN' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4–6 digits' })
  pin: string;
}

export class ParentLoginDto {
  @ApiProperty({ example: 'CTP' })
  @IsString()
  schoolCode: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Length(4, 20)
  mobile: string;

  @ApiProperty({ example: '1234', description: '4–6 digit PIN' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4–6 digits' })
  pin: string;
}
