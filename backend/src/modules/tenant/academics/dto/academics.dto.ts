import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export const PROMOTION_ACTIONS = ['promote', 'detain', 'transfer'] as const;
export type PromotionAction = (typeof PROMOTION_ACTIONS)[number];

export class BulkEnrollDto {
  @ApiProperty()
  @IsUUID()
  academicYearId: string;

  @ApiProperty()
  @IsUUID()
  classId: string;

  @ApiProperty()
  @IsUUID()
  sectionId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  studentIds: string[];

  @ApiPropertyOptional({ description: 'Auto-number rolls from this value' })
  @IsOptional()
  @IsInt()
  @Min(1)
  startRoll?: number;
}

export class PromotionDecisionDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ enum: PROMOTION_ACTIONS })
  @IsEnum(PROMOTION_ACTIONS)
  action: PromotionAction;

  @ApiPropertyOptional({ description: 'Required for promote/detain' })
  @IsOptional()
  @IsUUID()
  toClassId?: string;

  @ApiPropertyOptional({ description: 'Required for promote/detain' })
  @IsOptional()
  @IsUUID()
  toSectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollNumber?: string;
}

export class PromoteDto {
  @ApiProperty()
  @IsUUID()
  fromAcademicYearId: string;

  @ApiProperty()
  @IsUUID()
  toAcademicYearId: string;

  @ApiProperty({ type: [PromotionDecisionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PromotionDecisionDto)
  decisions: PromotionDecisionDto[];
}
