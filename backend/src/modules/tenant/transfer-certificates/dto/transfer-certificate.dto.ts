import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export const TC_REASONS = [
  'transfer',
  'completion',
  'expulsion',
  'withdrawal',
  'other',
] as const;

export const TC_CONDUCTS = [
  'excellent',
  'good',
  'satisfactory',
  'poor',
] as const;

export class IssueTcDto {
  @ApiProperty({ description: 'Student to issue the certificate for' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ enum: TC_REASONS })
  @IsEnum(TC_REASONS)
  reason: (typeof TC_REASONS)[number];

  @ApiPropertyOptional({ enum: TC_CONDUCTS, default: 'good' })
  @IsOptional()
  @IsEnum(TC_CONDUCTS)
  conduct?: (typeof TC_CONDUCTS)[number];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  feesCleared?: boolean;

  @ApiPropertyOptional({
    example: '2026-06-09',
    description: 'Defaults to today when omitted',
  })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({
    description:
      'Last class attended. Auto-resolved from the current enrollment when omitted.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  lastClass?: string;
}

export class TcListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TC_REASONS })
  @IsOptional()
  @IsEnum(TC_REASONS)
  reason?: (typeof TC_REASONS)[number];

  @ApiPropertyOptional({ enum: ['xlsx', 'pdf'] })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
}
