import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { BiometricPremiumGuard } from './biometric-premium.guard';
import { BiometricDevicesService } from './biometric-devices.service';
import {
  ListEnrollmentsQueryDto,
  ListTransactionsQueryDto,
  UpdateAliasDto,
} from './dto/biometric-query.dto';

const userId = (req: Request): string =>
  ((req as any).user?.sub ?? (req as any).user?.id ?? '') as string;

@ApiTags('school/biometric-devices')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard, BiometricPremiumGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/biometric-devices')
export class BiometricDevicesController {
  constructor(private readonly svc: BiometricDevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List devices assigned to this school' })
  list(@Tenant() t: TenantContext) {
    return this.svc.listDevices(t.schoolId);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List attendance punches' })
  transactions(@Tenant() t: TenantContext, @Query() q: ListTransactionsQueryDto) {
    return this.svc.transactions(t.schoolId, t.schemaName, q);
  }

  @Get('enrollments')
  @ApiOperation({ summary: 'List enrolled biometric templates' })
  enrollments(@Tenant() t: TenantContext, @Query() q: ListEnrollmentsQueryDto) {
    return this.svc.enrollments(t.schoolId, t.schemaName, q);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Device / attendance summary' })
  stats(@Tenant() t: TenantContext) {
    return this.svc.stats(t.schoolId, t.schemaName);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Device detail' })
  get(@Tenant() t: TenantContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findDevice(t.schoolId, id);
  }

  @Get(':id/commands')
  @ApiOperation({ summary: 'Recent commands for a device' })
  commands(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.deviceCommands(t.schoolId, id);
  }

  @Patch(':id/alias')
  @ApiOperation({ summary: 'Rename a device' })
  rename(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAliasDto,
  ) {
    return this.svc.updateAlias(t.schoolId, id, dto.alias);
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Queue a reboot command' })
  restart(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.restart(t.schoolId, id, userId(req));
  }

  @Post(':id/sync-users')
  @ApiOperation({ summary: 'Push all active students + staff to the device' })
  syncUsers(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.syncUsers(t.schoolId, t.schemaName, id, userId(req));
  }

  @Post(':id/clear-data')
  @ApiOperation({ summary: 'Clear attendance logs on the device (keep users)' })
  clearData(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.clearData(t.schoolId, id, userId(req));
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Delete a punch (admin correction)' })
  deleteTransaction(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.deleteTransaction(t.schoolId, t.schemaName, id);
  }
}
