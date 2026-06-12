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
import { DocumentsService } from './documents.service';
import {
  CreateStudentDocumentDto,
  UpdateStudentDocumentDto,
} from './dto/document.dto';

@ApiTags('school/student-documents')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Controller('school/student-documents')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @RequirePermissions('/students:list')
  @Get()
  @ApiOperation({ summary: 'List a student’s uploaded documents' })
  list(
    @Tenant() t: TenantContext,
    @Query('studentId', new ParseUUIDPipe()) studentId: string,
  ) {
    return this.svc.list(t.schemaName, t.schoolId, studentId);
  }

  @RequirePermissions('/students:create')
  @Post()
  create(@Tenant() t: TenantContext, @Body() dto: CreateStudentDocumentDto) {
    return this.svc.create(t.schemaName, t.schoolId, dto);
  }

  @RequirePermissions('/students:create')
  @Patch(':id')
  update(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStudentDocumentDto,
  ) {
    return this.svc.update(t.schemaName, t.schoolId, id, dto);
  }

  @RequirePermissions('/students:delete')
  @Delete(':id')
  remove(
    @Tenant() t: TenantContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.svc.remove(t.schemaName, t.schoolId, id);
  }
}
