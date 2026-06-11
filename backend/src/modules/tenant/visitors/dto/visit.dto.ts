import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
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

export const VISIT_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
] as const;

export class CreateVisitDto {
  @ApiProperty({ description: 'Registered visitor (carries the student link)' })
  @IsUUID()
  visitorId: string;

  @ApiPropertyOptional({
    description: 'Specific person to also meet (e.g. class teacher, warden)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  meetingWith?: string;

  @ApiProperty({ example: 'Meet ward' })
  @IsString()
  @Length(1, 255)
  purpose: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  vehicleNumber?: string;

  @ApiProperty({ example: '2026-06-10' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ example: '11:30' })
  @IsOptional()
  @IsString()
  scheduledTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  belongings?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class RejectVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class CheckInDto {
  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional({ example: 'V-001' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  passNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  belongings?: string;
}

export class CheckOutDto {
  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class VisitListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VISIT_STATUSES })
  @IsOptional()
  @IsEnum(VISIT_STATUSES)
  status?: (typeof VISIT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  visitorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['xlsx', 'pdf'] })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
}
