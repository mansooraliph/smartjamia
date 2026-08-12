import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export const SUB_STATUSES = [
  'trial',
  'active',
  'grace_period',
  'cancelled',
  'expired',
] as const;
export type SubStatus = (typeof SUB_STATUSES)[number];

export const BILLING_CYCLES = ['monthly', 'yearly', 'lifetime'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const PAYMENT_GATEWAYS = ['razorpay', 'stripe', 'manual'] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  schoolId: string;

  @ApiProperty()
  @IsUUID()
  planId: string;

  @ApiPropertyOptional({ enum: SUB_STATUSES, default: 'trial' })
  @IsOptional()
  @IsEnum(SUB_STATUSES)
  status?: SubStatus;

  @ApiProperty({ enum: BILLING_CYCLES, default: 'monthly' })
  @IsEnum(BILLING_CYCLES)
  billingCycle: BillingCycle;

  @ApiProperty({ example: 99900, description: 'Amount in paise' })
  @IsInt()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean;

  @ApiPropertyOptional({ enum: PAYMENT_GATEWAYS })
  @IsOptional()
  @IsEnum(PAYMENT_GATEWAYS)
  paymentGateway?: PaymentGateway;
}
