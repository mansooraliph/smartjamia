import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountGuard } from '../../common/guards/account.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AccountGuard, OrganizationGuard],
  exports: [AuthService],
})
export class AuthModule {}
