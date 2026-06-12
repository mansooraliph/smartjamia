import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateStudentQualificationDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: '10th / SSLC' })
  @IsString()
  @Length(1, 150)
  examName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  board?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  institution?: string;

  @ApiPropertyOptional({ example: 2021 })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearOfPassing?: number;

  @ApiPropertyOptional({ example: '78%' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  percentage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  registerNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class UpdateStudentQualificationDto extends PartialType(
  CreateStudentQualificationDto,
) {}
