import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @ApiPropertyOptional({
    description:
      'Confirm lowering max_schools_allowed below the current school count. ' +
      'Without this, such a change is rejected.',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
