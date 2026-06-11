import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TenantJwtGuard } from '../../../common/guards/tenant-jwt.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { ADMIN_ROLES } from '../../../common/constants/roles';
import { Tenant } from '../../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantContext } from '../../../common/tenant/tenant-context';
import { AcademicsService } from './academics.service';
import { BulkEnrollDto, PromoteDto } from './dto/academics.dto';

@ApiTags('school/academics')
@ApiBearerAuth('bearer')
@UseGuards(TenantJwtGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('school/academics')
export class AcademicsController {
  constructor(private readonly svc: AcademicsService) {}

  @RequirePermissions('/promotion:create')
  @Post('bulk-enroll')
  @ApiOperation({ summary: 'Assign/move many students into a class & section' })
  bulkEnroll(@Tenant() t: TenantContext, @Body() dto: BulkEnrollDto) {
    return this.svc.bulkEnroll(t.schemaName, t.schoolId, dto);
  }

  @RequirePermissions('/promotion:list')
  @Get('promotion/source')
  @ApiOperation({ summary: 'Source classes with active-student counts' })
  @ApiQuery({ name: 'academicYearId', required: true })
  promotionSource(
    @Tenant() t: TenantContext,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.svc.promotionSource(t.schemaName, t.schoolId, academicYearId);
  }

  @RequirePermissions('/promotion:list')
  @Get('promotion/class-students')
  @ApiOperation({ summary: 'Active students in a class for the promotion table' })
  @ApiQuery({ name: 'academicYearId', required: true })
  @ApiQuery({ name: 'classId', required: true })
  classStudents(
    @Tenant() t: TenantContext,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
  ) {
    return this.svc.classStudents(
      t.schemaName,
      t.schoolId,
      academicYearId,
      classId,
    );
  }

  @RequirePermissions('/promotion:create')
  @Post('promote')
  @ApiOperation({ summary: 'Promote / detain / transfer students into a year' })
  promote(
    @Tenant() t: TenantContext,
    @CurrentUser('sub') userId: string,
    @Body() dto: PromoteDto,
  ) {
    return this.svc.promote(t.schemaName, t.schoolId, userId, dto);
  }
}
