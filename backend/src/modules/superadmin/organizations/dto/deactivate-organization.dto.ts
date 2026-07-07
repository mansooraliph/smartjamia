import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AttachSchoolDto {
  @ApiProperty({ description: 'Id of the existing school to attach.' })
  @IsUUID()
  schoolId: string;
}

export class DeactivateOrganizationDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'When true, also suspend every school under this organization ' +
      '(blocking all logins to those schools). When false, only the ' +
      'organization itself is frozen; its schools keep running.',
  })
  @IsOptional()
  @IsBoolean()
  suspendSchools?: boolean;
}
