import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM (24h)

export class TimetableQueryDto {
  @IsUUID()
  sectionId: string;

  @IsUUID()
  academicYearId: string;
}

export class PeriodDto {
  @IsInt()
  @Min(1)
  @Max(20)
  periodNumber: number;

  @Matches(TIME_RE, { message: 'startTime must be HH:MM' })
  startTime: string;

  @Matches(TIME_RE, { message: 'endTime must be HH:MM' })
  endTime: string;
}

export class CellDto {
  @IsString()
  @Matches(new RegExp(`^(${DAYS_OF_WEEK.join('|')})$`), {
    message: 'invalid dayOfWeek',
  })
  dayOfWeek: (typeof DAYS_OF_WEEK)[number];

  @IsInt()
  @Min(1)
  @Max(20)
  periodNumber: number;

  @IsUUID()
  subjectId: string;

  @IsOptional()
  @IsUUID()
  staffId?: string | null;
}

export class SaveTimetableDto {
  @IsUUID()
  sectionId: string;

  @IsUUID()
  academicYearId: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PeriodDto)
  periods: PeriodDto[];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CellDto)
  cells: CellDto[];
}
