import { ApiProperty } from '@nestjs/swagger';

export class ApiSuccessDto<T = unknown> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty()
  data: T;

  @ApiProperty({ required: false })
  message?: string;

  @ApiProperty()
  timestamp: string;
}

export class ApiErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code: string;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiProperty({ required: false })
  details?: unknown;
}

export class ApiErrorDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: ApiErrorBodyDto })
  error: ApiErrorBodyDto;

  @ApiProperty()
  timestamp: string;
}
