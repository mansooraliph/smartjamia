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
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { BiometricDevicesAdminService } from './biometric-devices-admin.service';
import {
  AssignDeviceDto,
  BulkDeviceActionDto,
  DeactivateDeviceDto,
  ListCommandsQueryDto,
  ListDevicesQueryDto,
} from './dto/biometric-device.dto';

const adminId = (req: Request): string =>
  ((req as any).user?.sub ?? (req as any).user?.id ?? '') as string;

@ApiTags('superadmin/biometric-devices')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/biometric-devices')
export class BiometricDevicesAdminController {
  constructor(private readonly svc: BiometricDevicesAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all biometric devices' })
  list(@Query() q: ListDevicesQueryDto) {
    return this.svc.list(q);
  }

  @Get('unassigned')
  @ApiOperation({ summary: 'List devices not yet assigned to a school' })
  unassigned() {
    return this.svc.unassigned();
  }

  @Get('commands')
  @ApiOperation({ summary: 'List recent device commands' })
  commands(@Query() q: ListCommandsQueryDto) {
    return this.svc.listCommands(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a device' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/commands')
  @ApiOperation({ summary: 'Recent commands for a device' })
  deviceCommands(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.deviceCommands(id);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign a device to a school' })
  assign(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignDeviceDto,
  ) {
    return this.svc.assignToSchool(id, dto.schoolId, adminId(req));
  }

  @Patch(':id/unassign')
  @ApiOperation({ summary: 'Remove a device’s school assignment' })
  unassign(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.unassign(id);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a device' })
  approve(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.approve(id, adminId(req));
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a device' })
  deactivate(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DeactivateDeviceDto,
  ) {
    return this.svc.deactivate(id, adminId(req), dto.reason);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate a device' })
  reactivate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.reactivate(id);
  }

  // Literal `bulk/*` routes declared before `:id/*` so `/bulk/...` is not
  // matched as `:id = "bulk"`.
  @Post('bulk/restart')
  @ApiOperation({ summary: 'Restart multiple devices' })
  bulkRestart(@Req() req: Request, @Body() dto: BulkDeviceActionDto) {
    return this.svc.bulkRestart(dto.deviceIds, adminId(req));
  }

  @Post('bulk/read-info')
  @ApiOperation({ summary: 'Send INFO to multiple devices' })
  bulkReadInfo(@Req() req: Request, @Body() dto: BulkDeviceActionDto) {
    return this.svc.bulkReadInfo(dto.deviceIds, adminId(req));
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Queue a reboot command' })
  restart(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.queueRestart(id, adminId(req));
  }

  @Post(':id/read-info')
  @ApiOperation({ summary: 'Send an INFO command to a single device' })
  readInfo(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.readInfo(id, adminId(req));
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Queue an info-sync command' })
  sync(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.queueSync(id, adminId(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a device' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}
