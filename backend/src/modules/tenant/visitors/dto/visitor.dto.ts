import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export const VISITOR_GENDERS = ['male', 'female', 'other'] as const;

export class CreateVisitorDto {
  @ApiProperty({ description: 'The student this visitor comes to visit' })
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    description: 'Relation to the student',
    example: 'Father',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  relation?: string;

  @ApiPropertyOptional({ enum: VISITOR_GENDERS })
  @IsOptional()
  @IsEnum(VISITOR_GENDERS)
  gender?: (typeof VISITOR_GENDERS)[number];

  @ApiProperty()
  @IsString()
  @Length(1, 20)
  mobile: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  place?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Aadhar' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  idProofType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  idProofNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isBlacklisted?: boolean;
}

export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {}

export class VisitorListQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ enum: VISITOR_GENDERS })
  @IsOptional()
  @IsEnum(VISITOR_GENDERS)
  gender?: (typeof VISITOR_GENDERS)[number];

  @ApiPropertyOptional({ description: 'true to show only blacklisted' })
  @IsOptional()
  @IsIn(['true', 'false'])
  blacklisted?: string;

  @ApiPropertyOptional({ enum: ['xlsx', 'pdf'] })
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format?: 'xlsx' | 'pdf';
}
