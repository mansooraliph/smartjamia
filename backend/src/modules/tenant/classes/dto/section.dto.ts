import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateSectionDto {
  @ApiProperty()
  @IsUUID()
  classId: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @Length(1, 10)
  name: string;

  @ApiPropertyOptional({ default: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classTeacherId?: string;
}

export class UpdateSectionDto extends PartialType(CreateSectionDto) {}
