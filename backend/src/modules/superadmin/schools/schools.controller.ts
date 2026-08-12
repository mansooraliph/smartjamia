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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SchoolsService } from './schools.service';
import { SchoolProvisioningService } from './school-provisioning.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SetOwnerDto } from './dto/set-owner.dto';
import { AuthService } from '../../auth/auth.service';

@ApiTags('superadmin/schools')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/schools')
export class SchoolsController {
  constructor(
    private readonly schools: SchoolsService,
    private readonly provisioning: SchoolProvisioningService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all schools (optionally filtered by org)' })
  @ApiQuery({ name: 'organizationId', required: false })
  list(@Query('organizationId') organizationId?: string) {
    return this.schools.list(organizationId || undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get school by id' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.schools.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a school' })
  create(@Body() dto: CreateSchoolDto) {
    return this.schools.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a school' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSchoolDto,
  ) {
    return this.schools.update(id, dto);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Quick counts for the school-detail page (students/staff/classes/sections)',
  })
  getSummary(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.schools.getSummary(id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: "List this school's tenant login accounts (staff roles)" })
  getUsers(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.schools.getUsers(id);
  }

  @Get(':id/owner')
  @ApiOperation({ summary: "Get the school's admin (owner) account" })
  getOwner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.schools.getOwner(id);
  }

  @Put(':id/owner')
  @ApiOperation({
    summary: "Change the school's admin (name/email) and/or reset the password",
  })
  setOwner(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetOwnerDto,
  ) {
    return this.schools.setOwner(id, dto);
  }

  @Post(':id/impersonate')
  @ApiOperation({
    summary:
      "Impersonate this school's admin (owner) — issues a tenant session for support/testing, no password needed",
  })
  impersonate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') superadminId: string,
  ) {
    return this.auth.impersonateSchool(id, superadminId);
  }

  @Post(':id/provision')
  @ApiOperation({
    summary: 'Provision a dedicated schema for the school (off shared_pool)',
  })
  provision(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.provisioning.provision(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a school' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.schools.remove(id);
  }
}
