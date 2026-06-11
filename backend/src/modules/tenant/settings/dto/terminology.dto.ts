import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class TerminologyDto {
  @ApiPropertyOptional({ example: 'Class', description: 'Singular level label' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  level?: string;

  @ApiPropertyOptional({ example: 'Classes' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  levelPlural?: string;

  @ApiPropertyOptional({ example: 'Section', description: 'Singular group label' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  group?: string;

  @ApiPropertyOptional({ example: 'Sections' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  groupPlural?: string;
}

export interface Terminology {
  level: string;
  levelPlural: string;
  group: string;
  groupPlural: string;
}

export const DEFAULT_TERMINOLOGY: Terminology = {
  level: 'Class',
  levelPlural: 'Classes',
  group: 'Section',
  groupPlural: 'Sections',
};
