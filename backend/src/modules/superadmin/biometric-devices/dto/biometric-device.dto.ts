import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

export class AssignDeviceDto {
  @IsUUID()
  schoolId: string;
}

export class DeactivateDeviceDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class BulkDeviceActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  deviceIds: string[];
}

export interface BulkActionResult {
  success_count: number;
  failed_count: number;
  failed_devices: string[];
  message: string;
}

export class ListDevicesQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional({ description: 'Filter by whether assigned to a school' })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  isAssigned?: boolean;
}

export class ListCommandsQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sn?: string;

  @ApiPropertyOptional({ description: '0 pending, 1 success, 2 error' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  status?: number;
}
