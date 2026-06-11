import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { SettingsService } from './settings.service';
import { TerminologyDto } from './dto/terminology.dto';
import { MenuAccessDto } from './dto/menu-access.dto';

@ApiTags('school/settings')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school/settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('terminology')
  @ApiOperation({ summary: 'Academic terminology labels (level/group)' })
  getTerminology(@Tenant() t: TenantContext) {
    return this.svc.getTerminology(t.schemaName, t.schoolId);
  }

  @Put('terminology')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update academic terminology labels' })
  setTerminology(@Tenant() t: TenantContext, @Body() dto: TerminologyDto) {
    return this.svc.setTerminology(t.schemaName, t.schoolId, dto);
  }

  @Get('menu-access')
  @ApiOperation({ summary: 'Per-role menu/module visibility overrides' })
  getMenuAccess(@Tenant() t: TenantContext) {
    return this.svc.getMenuAccess(t.schemaName, t.schoolId);
  }

  @Put('menu-access')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Set per-role menu/module visibility' })
  setMenuAccess(@Tenant() t: TenantContext, @Body() dto: MenuAccessDto) {
    return this.svc.setMenuAccess(t.schemaName, t.schoolId, dto);
  }
}
