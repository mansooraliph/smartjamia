import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export type InstitutionType = 'school' | 'college';

export class TerminologyDto {
  @ApiPropertyOptional({ enum: ['school', 'college'] })
  @IsOptional()
  @IsIn(['school', 'college'])
  institutionType?: InstitutionType;

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
  institutionType: InstitutionType;
}

export const DEFAULT_TERMINOLOGY: Terminology = {
  level: 'Class',
  levelPlural: 'Classes',
  group: 'Section',
  groupPlural: 'Sections',
  institutionType: 'school',
};
