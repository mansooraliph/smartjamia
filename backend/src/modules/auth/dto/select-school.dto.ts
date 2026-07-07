import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SelectSchoolDto {
  @ApiProperty({ description: 'Id of the school to enter.' })
  @IsUUID()
  schoolId: string;
}
