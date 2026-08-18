import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SuperadminLoginDto } from './dto/superadmin-login.dto';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { ParentLoginDto, StudentLoginDto } from './dto/pin-login.dto';
import { AccountLoginDto } from './dto/account-login.dto';
import { OrganizationLoginDto } from './dto/organization-login.dto';
import { SelectSchoolDto } from './dto/select-school.dto';
import { AccountGuard } from '../../common/guards/account.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('superadmin/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Superadmin login (platform-level)' })
  @ApiResponse({
    status: 200,
    description: 'Returns access + refresh tokens and superadmin user.',
  })
  superadminLogin(@Body() dto: SuperadminLoginDto) {
    return this.auth.superadminLogin(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'School user login (tenant-level)' })
  @ApiResponse({
    status: 200,
    description: 'Returns access + refresh tokens, user, and school context.',
  })
  tenantLogin(@Body() dto: TenantLoginDto) {
    return this.auth.tenantLogin(dto.schoolCode, dto.email, dto.password);
  }

  @Post('student-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Student portal login (admission number + PIN)' })
  studentLogin(@Body() dto: StudentLoginDto) {
    return this.auth.studentLogin(dto.schoolCode, dto.admissionNumber, dto.pin);
  }

  @Post('parent-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Parent portal login (mobile + PIN)' })
  parentLogin(@Body() dto: ParentLoginDto) {
    return this.auth.parentLogin(dto.schoolCode, dto.mobile, dto.pin);
  }

  // ─── Multi-school account (one login → many schools) ──────────────────────
  @Post('account/login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Central account login — returns the schools this login can enter',
  })
  accountLogin(@Req() req: Request, @Body() dto: AccountLoginDto) {
    return this.auth.accountLogin(
      dto.email,
      dto.password,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
  }

  @Post('account/select-school')
  @HttpCode(200)
  @UseGuards(AccountGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Enter a granted school → returns a normal tenant session',
  })
  accountSelectSchool(@Req() req: Request, @Body() dto: SelectSchoolDto) {
    const { sub } = (req as any).user;
    return this.auth.accountSelectSchool(
      sub,
      dto.schoolId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
  }

  // ─── Organization admin ───────────────────────────────────────────────────
  @Post('organization/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Organization admin login' })
  organizationLogin(@Body() dto: OrganizationLoginDto) {
    return this.auth.organizationLogin(dto.email, dto.password);
  }

  @Post('organization/select-school')
  @HttpCode(200)
  @UseGuards(OrganizationGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: "Enter one of the org's schools → returns a tenant session (admin)",
  })
  organizationSelectSchool(@Req() req: Request, @Body() dto: SelectSchoolDto) {
    const { sub, organizationId } = (req as any).user;
    return this.auth.organizationSelectSchool(sub, organizationId, dto.schoolId);
  }
}
