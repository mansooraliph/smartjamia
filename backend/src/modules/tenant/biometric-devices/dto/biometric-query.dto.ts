import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class ListTransactionsQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional({ description: '0 = check-in, 1 = check-out' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  punchState?: number;

  @ApiPropertyOptional({ description: 'Device serial number' })
  @IsOptional()
  @IsString()
  deviceSn?: string;

  @ApiPropertyOptional({ enum: ['student', 'teacher', 'staff', 'visitor'] })
  @IsOptional()
  @IsIn(['student', 'teacher', 'staff', 'visitor'])
  userType?: string;

  @ApiPropertyOptional({ description: 'Restrict to students in this class' })
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class ListEnrollmentsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['FP', 'FACE', 'PALM', 'USERPIC', 'BIOPHOTO'] })
  @IsOptional()
  @IsIn(['FP', 'FACE', 'PALM', 'USERPIC', 'BIOPHOTO'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userCode?: string;

  @ApiPropertyOptional({ enum: ['student', 'teacher', 'staff', 'visitor'] })
  @IsOptional()
  @IsIn(['student', 'teacher', 'staff', 'visitor'])
  userType?: string;

  @ApiPropertyOptional({ description: 'Restrict to students in this class' })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ description: 'All enrollment rows for one student' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: 'All enrollment rows for one staff/teacher' })
  @IsOptional()
  @IsUUID()
  staffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class UpdateAliasDto {
  @IsString()
  alias: string;
}
