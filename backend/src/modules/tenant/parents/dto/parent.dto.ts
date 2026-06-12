import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export const PARENT_RELATIONS = ['father', 'mother', 'guardian'] as const;

export class CreateParentDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ enum: PARENT_RELATIONS })
  @IsEnum(PARENT_RELATIONS)
  relation: (typeof PARENT_RELATIONS)[number];

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  phoneCountryCode?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 20)
  phone: string;

  @ApiPropertyOptional({ example: '+91' })
  @IsOptional()
  @IsString()
  @Length(1, 8)
  whatsappCountryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  occupation?: string;

  @ApiPropertyOptional({ description: 'Annual income in rupees' })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualIncome?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 12)
  aadharNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateParentDto extends PartialType(CreateParentDto) {}

export class ParentListQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ enum: PARENT_RELATIONS })
  @IsOptional()
  @IsEnum(PARENT_RELATIONS)
  relation?: (typeof PARENT_RELATIONS)[number];

  @ApiPropertyOptional({ enum: ['xlsx', 'pdf'] })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
}
