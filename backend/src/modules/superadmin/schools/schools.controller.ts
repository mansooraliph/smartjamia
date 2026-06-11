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
import { SchoolsService } from './schools.service';
import { SchoolProvisioningService } from './school-provisioning.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@ApiTags('superadmin/schools')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/schools')
export class SchoolsController {
  constructor(
    private readonly schools: SchoolsService,
    private readonly provisioning: SchoolProvisioningService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all schools' })
  list() {
    return this.schools.list();
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
