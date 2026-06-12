import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export const STUDENT_DOCUMENT_TYPES = [
  'aadhaar',
  'birth_certificate',
  'transfer_certificate',
  'marksheet',
  'id_proof',
  'address_proof',
  'caste_certificate',
  'income_certificate',
  'photo',
  'other',
] as const;

export class CreateStudentDocumentDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ enum: STUDENT_DOCUMENT_TYPES })
  @IsEnum(STUDENT_DOCUMENT_TYPES)
  type: (typeof STUDENT_DOCUMENT_TYPES)[number];

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

export class UpdateStudentDocumentDto extends PartialType(
  CreateStudentDocumentDto,
) {}
