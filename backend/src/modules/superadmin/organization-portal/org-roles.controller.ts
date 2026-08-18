import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Request } from 'express';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { School } from '../../../database/master/school.entity';
import { RolesService } from '../../tenant/roles/roles.service';
import { CreateRoleDto, UpdateRoleDto } from '../../tenant/roles/dto/role.dto';

/**
 * Org Admin's view of each school's custom roles & permissions. `RolesService`
 * is schema/schoolId-parametrized already (no tenant-JWT assumptions baked
 * in), so this just resolves the school's schemaName and re-uses it directly.
 */
@ApiTags('org-portal/roles')
@ApiBearerAuth('bearer')
@UseGuards(OrganizationGuard)
@Controller('org/schools/:schoolId/roles')
export class OrgRolesController {
  private readonly schoolRepo: Repository<School>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly roles: RolesService,
  ) {
    this.schoolRepo = ds.getRepository(School);
  }

  private async resolveSchool(req: Request, schoolId: string) {
    const organizationId = (req as any).user.organizationId;
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school || school.organizationId !== organizationId) {
      throw new NotFoundException('School not found in this organization');
    }
    return school;
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Permission catalog (modules × actions)' })
  catalog() {
    return this.roles.catalog();
  }

  @Get()
  @ApiOperation({ summary: "All of a school's roles (built-in + custom)" })
  async list(@Req() req: Request, @Param('schoolId', new ParseUUIDPipe()) schoolId: string) {
    const school = await this.resolveSchool(req, schoolId);
    return this.roles.list(school.schemaName, school.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom role for a school' })
  async create(
    @Req() req: Request,
    @Param('schoolId', new ParseUUIDPipe()) schoolId: string,
    @Body() dto: CreateRoleDto,
  ) {
    const school = await this.resolveSchool(req, schoolId);
    return this.roles.create(school.schemaName, school.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a custom role' })
  async update(
    @Req() req: Request,
    @Param('schoolId', new ParseUUIDPipe()) schoolId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const school = await this.resolveSchool(req, schoolId);
    return this.roles.update(school.schemaName, school.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom role (if unassigned)' })
  async remove(
    @Req() req: Request,
    @Param('schoolId', new ParseUUIDPipe()) schoolId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const school = await this.resolveSchool(req, schoolId);
    return this.roles.remove(school.schemaName, school.id, id);
  }
}
