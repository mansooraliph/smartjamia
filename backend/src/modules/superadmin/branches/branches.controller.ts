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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@ApiTags('superadmin/branches')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List branches (optionally filter by schoolId)' })
  @ApiQuery({ name: 'schoolId', required: false })
  list(@Query('schoolId') schoolId?: string) {
    return this.branches.list(schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by id' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.branches.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a branch' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branches.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a branch' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.branches.remove(id);
  }
}
