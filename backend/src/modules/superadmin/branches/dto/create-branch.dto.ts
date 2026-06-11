import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';

export const BRANCH_STATUSES = ['active', 'inactive'] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

export class CreateBranchDto {
  @ApiProperty()
  @IsUUID()
  schoolId: string;

  @ApiProperty({ example: 'Delhi Campus' })
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiProperty({ example: 'DEL' })
  @IsString()
  @Length(1, 50)
  @Matches(/^[A-Z0-9-]+$/, { message: 'Code must be uppercase alphanumeric' })
  code: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  principalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  studentCapacity?: number;

  @ApiPropertyOptional({ enum: BRANCH_STATUSES, default: 'active' })
  @IsOptional()
  @IsEnum(BRANCH_STATUSES)
  status?: BranchStatus;
}
