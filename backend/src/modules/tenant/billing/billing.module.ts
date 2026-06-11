import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController, RazorpayWebhookController],
  providers: [BillingService],
})
export class BillingModule {}
