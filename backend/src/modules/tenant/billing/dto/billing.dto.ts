import { IsIn, IsString, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  planId: string;

  @IsIn(['monthly', 'yearly'])
  billingCycle: 'monthly' | 'yearly';
}

export class VerifyPaymentDto {
  @IsUUID()
  planId: string;

  @IsIn(['monthly', 'yearly'])
  billingCycle: 'monthly' | 'yearly';

  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}
