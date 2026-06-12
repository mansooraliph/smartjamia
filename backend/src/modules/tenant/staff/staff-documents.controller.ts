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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { StaffDocumentsService } from './staff-documents.service';
import {
  CreateStaffDocumentDto,
  UpdateStaffDocumentDto,
} from './dto/staff-document.dto';

@ApiTags('school/staff-documents')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school/staff-documents')
export class StaffDocumentsController {
  constructor(private readonly svc: StaffDocumentsService) {}

  @RequirePermissions('/staff:list')
  @Get()
  @ApiOperation({ summary: 'List a staff member’s documents' })
  list(
    @Tenant() t: TenantContext,
    @Query('staffId', new ParseUUIDPipe()) staffId: string,
  ) {
    return this.svc.list(t.schemaName, t.schoolId, staffId);
  }

  @RequirePermissions('/staff:create')
  @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CreateStaffDocumentDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @RequirePermissions('/staff:create')
  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStaffDocumentDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @RequirePermissions('/staff:delete')
  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
