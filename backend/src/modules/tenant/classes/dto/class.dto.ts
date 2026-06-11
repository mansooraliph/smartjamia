import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateClassDto {
  @ApiProperty()
  @IsUUID()
  academicYearId: string;

  @ApiPropertyOptional({ description: 'Parent course/program (college mode)' })
  @IsOptional()
  @IsUUID()
  courseId?: string | null;

  @ApiProperty({ example: 'Class 10' })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}
