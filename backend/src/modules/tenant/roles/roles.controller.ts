import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { PermissionsService } from '../../../common/rbac/permissions.service';
import { isSystemRole } from '../../../common/rbac/permissions';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@ApiTags('school/roles')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school')
export class RolesController {
  constructor(
    private readonly svc: RolesService,
    private readonly perms: PermissionsService,
  ) {}

  /** Current user's effective role + permission set (any authenticated user). */
  @Get('me')
  @ApiOperation({ summary: 'Logged-in user role + effective permissions' })
  async me(@Req() req: any) {
    const held = await this.perms.resolve(req);
    return {
      role: req.user.role,
      isSystem: isSystemRole(req.user.role),
      isAdmin: this.perms.isAdmin(req.user.role),
      permissions: [...held],
    };
  }

  @Get('roles/catalog')
  @RequirePermissions('/roles:list')
  @ApiOperation({ summary: 'Permission catalog (modules × actions)' })
  catalog() {
    return this.svc.catalog();
  }

  @Get('roles')
  @RequirePermissions('/roles:list')
  @ApiOperation({ summary: 'All roles (built-in + custom)' })
  list(@Tenant() t: TenantContext) {
    return this.svc.list(t.schemaName, t.schoolId);
  }

  @Post('roles')
  @RequirePermissions('/roles:create')
  @ApiOperation({ summary: 'Create a custom role' })
  create(@Tenant() t: TenantContext, @Body() dto: CreateRoleDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @Patch('roles/:id')
  @RequirePermissions('/roles:create')
  @ApiOperation({ summary: 'Update a custom role' })
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('/roles:delete')
  @ApiOperation({ summary: 'Delete a custom role (if unassigned)' })
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
