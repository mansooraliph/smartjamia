import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export const STAFF_DOCUMENT_TYPES = [
  'aadhaar',
  'pan',
  'id_proof',
  'address_proof',
  'resume',
  'certificate',
  'qualification',
  'experience',
  'contract',
  'photo',
  'other',
] as const;

export class CreateStaffDocumentDto {
  @ApiProperty()
  @IsUUID()
  staffId: string;

  @ApiProperty({ enum: STAFF_DOCUMENT_TYPES })
  @IsEnum(STAFF_DOCUMENT_TYPES)
  type: (typeof STAFF_DOCUMENT_TYPES)[number];

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({ description: 'Public URL returned by /school/uploads' })
  @IsString()
  @Length(1, 500)
  fileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateStaffDocumentDto extends PartialType(
  CreateStaffDocumentDto,
) {}
