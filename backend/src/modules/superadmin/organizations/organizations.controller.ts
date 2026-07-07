import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  AttachSchoolDto,
  DeactivateOrganizationDto,
} from './dto/deactivate-organization.dto';

@ApiTags('superadmin/organizations')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations with school usage counts' })
  list() {
    return this.orgs.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization (with school usage)' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orgs.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.orgs.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update an organization (incl. max_schools_allowed; pass force to lower below current usage)',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgs.update(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate an organization (optionally suspend its schools)',
  })
  deactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DeactivateOrganizationDto,
  ) {
    return this.orgs.deactivate(id, dto.suspendSchools ?? false);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Re-activate an organization (restores schools it suspended)',
  })
  activate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orgs.activate(id);
  }

  @Get(':id/available-schools')
  @ApiOperation({
    summary: 'List unassigned schools that can be added to this organization',
  })
  availableSchools(@Param('id', new ParseUUIDPipe()) _id: string) {
    return this.orgs.availableSchools();
  }

  @Post(':id/schools/attach')
  @ApiOperation({
    summary: 'Attach an existing (unassigned) school to this organization',
  })
  attachSchool(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AttachSchoolDto,
  ) {
    return this.orgs.attachSchool(id, dto.schoolId);
  }

  @Delete(':id/schools/:schoolId')
  @ApiOperation({ summary: 'Remove a school from this organization' })
  detachSchool(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('schoolId', new ParseUUIDPipe()) schoolId: string,
  ) {
    return this.orgs.detachSchool(id, schoolId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an organization' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orgs.remove(id);
  }
}
