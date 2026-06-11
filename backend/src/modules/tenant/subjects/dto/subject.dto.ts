import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty()
  @IsUUID()
  classId: string;

  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: 'MATH' })
  @IsString()
  @Length(1, 20)
  code: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMarks?: number;

  @ApiPropertyOptional({ default: 35 })
  @IsOptional()
  @IsInt()
  @Min(0)
  passMarks?: number;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
