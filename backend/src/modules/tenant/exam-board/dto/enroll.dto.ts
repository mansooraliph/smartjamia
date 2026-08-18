import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator';

export class EnrollExamBoardDto {
  @ApiProperty({ description: 'Exam Board batch id (from the master catalog)' })
  @IsString()
  examBoardBatchId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  studentIds: string[];
}
