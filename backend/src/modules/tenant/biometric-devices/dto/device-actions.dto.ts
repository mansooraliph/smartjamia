import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export type BiometricType = 'fingerprint' | 'face' | 'palm';

/** Queue an arbitrary raw command to a device (manual / advanced). */
export class RunCommandDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  command: string;
}

/** Set the duplicate-punch (re-record) interval on a single device. */
export class SetDuplicatePunchDto {
  @IsInt()
  @Min(0)
  @Max(3600)
  seconds: number;
}

/** Trigger a remote enrollment on a single device. */
export class EnrollRemotelyDto {
  @IsString()
  @IsNotEmpty()
  userCode: string; // admission_number (student) or employee_id (staff)

  @IsEnum(['fingerprint', 'face', 'palm'])
  biometricType: BiometricType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  fingerId?: number; // 0-9, default 6 (left index finger)
}

/** Base payload for any bulk device action. */
export class BulkDeviceActionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  deviceIds: string[];
}

export class BulkSetDuplicatePunchDto extends BulkDeviceActionDto {
  @IsInt()
  @Min(0)
  @Max(3600)
  seconds: number;
}

export class BulkEnrollDto extends BulkDeviceActionDto {
  @IsString()
  @IsNotEmpty()
  userCode: string;

  @IsEnum(['fingerprint', 'face', 'palm'])
  biometricType: BiometricType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  fingerId?: number;
}

export interface BulkActionResult {
  success_count: number;
  failed_count: number;
  failed_devices: string[];
  message: string;
}

/** Update the per-school device PIN prefixes. Validated in the service. */
export class UpdateDeviceSettingsDto {
  @IsObject()
  prefixes: Record<string, string>;
}

export type EnrollUserType = 'student' | 'teacher' | 'staff' | 'visitor';

export class ListEnrollUsersQueryDto {
  @IsEnum(['student', 'teacher', 'staff', 'visitor'])
  type: EnrollUserType;

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Enroll a chosen user (of any type) onto one or more devices. The server
 * queues an add-user command plus the biometric enroll command on each device
 * and records a pending enrollment.
 */
export class EnrollUserDto {
  @IsEnum(['student', 'teacher', 'staff', 'visitor'])
  userType: EnrollUserType;

  @IsUUID()
  userId: string; // entity id of the student / staff / visitor

  @IsEnum(['fingerprint', 'face', 'palm'])
  biometricType: BiometricType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  fingerId?: number;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  deviceIds: string[];
}
