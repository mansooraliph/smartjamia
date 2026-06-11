import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { BillingService } from './billing.service';
import { CheckoutDto, VerifyPaymentDto } from './dto/billing.dto';

@ApiTags('school/billing')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/billing')
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get()
  @ApiOperation({ summary: 'Subscription, trial status, plan & invoices' })
  get(@Tenant() t: TenantContext) {
    return this.svc.getBilling(t.schoolId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create a Razorpay order to upgrade/subscribe' })
  checkout(@Tenant() t: TenantContext, @Body() dto: CheckoutDto) {
    return this.svc.checkout(t.schoolId, dto);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Razorpay payment + activate subscription' })
  verify(@Tenant() t: TenantContext, @Body() dto: VerifyPaymentDto) {
    return this.svc.verifyAndActivate(t.schoolId, dto);
  }
}
