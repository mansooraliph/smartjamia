import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Starter' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: 'starter' })
  @IsString()
  @Matches(/^[a-z][a-z0-9-]{0,99}$/, {
    message: 'slug must be lowercase, kebab-case',
  })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 99900, description: 'Monthly price in paise' })
  @IsInt()
  @Min(0)
  priceMonthly: number;

  @ApiProperty({ example: 999000, description: 'Yearly price in paise' })
  @IsInt()
  @Min(0)
  priceYearly: number;

  @ApiPropertyOptional({ default: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  maxUsers?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  maxStudents?: number;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  maxStaff?: number;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}
