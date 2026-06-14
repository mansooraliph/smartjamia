import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import {
  BulkDeviceActionDto,
  BulkEnrollDto,
  BulkSetDuplicatePunchDto,
  EnrollRemotelyDto,
  EnrollUserDto,
  ListEnrollUsersQueryDto,
  SetDuplicatePunchDto,
  UpdateDeviceSettingsDto,
} from './dto/device-actions.dto';

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

  @Get('enroll/users')
  @ApiOperation({
    summary: 'Search enrollable users (student/teacher/staff/visitor)',
  })
  enrollableUsers(
    @Tenant() t: TenantContext,
    @Query() q: ListEnrollUsersQueryDto,
  ) {
    return this.svc.listEnrollableUsers(
      t.schoolId,
      t.schemaName,
      q.type,
      q.search,
    );
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get device settings (PIN prefixes)' })
  getSettings(@Tenant() t: TenantContext) {
    return this.svc.getDeviceSettings(t.schoolId, t.schemaName);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update device settings (PIN prefixes)' })
  updateSettings(
    @Tenant() t: TenantContext,
    @Body() dto: UpdateDeviceSettingsDto,
  ) {
    return this.svc.updateDeviceSettings(t.schoolId, t.schemaName, dto.prefixes);
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

  // ── Bulk actions ────────────────────────────────────────────────────────────
  // NOTE: these literal `bulk/*` routes are declared BEFORE the `:id/*` routes
  // so Express does not match `/bulk/...` as `:id = "bulk"`.

  @Post('bulk/restart')
  @ApiOperation({ summary: 'Restart multiple devices' })
  bulkRestart(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Body() dto: BulkDeviceActionDto,
  ) {
    return this.svc.bulkRestart(dto.deviceIds, t.schoolId, userId(req));
  }

  @Post('bulk/read-info')
  @ApiOperation({ summary: 'Send INFO to multiple devices' })
  bulkReadInfo(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Body() dto: BulkDeviceActionDto,
  ) {
    return this.svc.bulkReadInfo(dto.deviceIds, t.schoolId, userId(req));
  }

  @Post('bulk/set-duplicate-punch')
  @ApiOperation({ summary: 'Set duplicate-punch interval on multiple devices' })
  bulkSetDuplicatePunch(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Body() dto: BulkSetDuplicatePunchDto,
  ) {
    return this.svc.bulkSetDuplicatePunch(
      dto.deviceIds,
      t.schoolId,
      dto.seconds,
      userId(req),
    );
  }

  @Post('bulk/enroll')
  @ApiOperation({ summary: 'Trigger remote enrollment on multiple devices' })
  bulkEnroll(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Body() dto: BulkEnrollDto,
  ) {
    return this.svc.bulkEnrollRemotely(
      dto.deviceIds,
      t.schoolId,
      t.schemaName,
      dto,
      userId(req),
    );
  }

  @Post('enrollments')
  @ApiOperation({
    summary:
      'Enroll a user (student/teacher/staff/visitor) onto selected devices',
  })
  enrollUser(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Body() dto: EnrollUserDto,
  ) {
    return this.svc.enrollUser(t.schoolId, t.schemaName, dto, userId(req));
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Queue a reboot command' })
  restart(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.restartDevice(t.schoolId, id, userId(req));
  }

  @Post(':id/read-info')
  @ApiOperation({ summary: 'Send an INFO command to a single device' })
  readInfo(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.readDeviceInfo(t.schoolId, id, userId(req));
  }

  @Post(':id/set-duplicate-punch')
  @ApiOperation({ summary: 'Set duplicate-punch interval on a single device' })
  setDuplicatePunch(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetDuplicatePunchDto,
  ) {
    return this.svc.setDuplicatePunch(
      t.schoolId,
      id,
      dto.seconds,
      userId(req),
    );
  }

  @Post(':id/enroll')
  @ApiOperation({ summary: 'Trigger remote enrollment on a single device' })
  enroll(
    @Req() req: Request,
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EnrollRemotelyDto,
  ) {
    return this.svc.enrollRemotely(
      t.schoolId,
      t.schemaName,
      id,
      dto,
      userId(req),
    );
  }

  @Post(':id/clear-commands')
  @ApiOperation({ summary: 'Delete all pending (queued) commands for a device' })
  clearCommands(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.clearPendingCommands(t.schoolId, id);
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
