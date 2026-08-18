import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { IdentityService } from '../identity/identity.service';
import {
  CreateGrantDto,
  CreateOrgUserDto,
  ResetPasswordDto,
} from '../identity/dto/identity.dto';

/**
 * Org Admin's view of central login accounts — every user across every
 * school in this organization, with cross-school grant management, password
 * resets, and login activity.
 */
@ApiTags('org-portal/users')
@ApiBearerAuth('bearer')
@UseGuards(OrganizationGuard)
@Controller('org/users')
export class OrgUsersController {
  constructor(private readonly identity: IdentityService) {}

  private orgId(req: Request): string {
    return (req as any).user.organizationId;
  }

  @Get()
  @ApiQuery({ name: 'schoolId', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiOperation({ summary: "List all users across the organization's schools" })
  list(
    @Req() req: Request,
    @Query('schoolId') schoolId?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.identity.listAccountsForOrg(this.orgId(req), {
      schoolId,
      role,
      status,
      search,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a user and grant access to one or more schools' })
  create(@Req() req: Request, @Body() dto: CreateOrgUserDto) {
    return this.identity.createAccountForOrg(this.orgId(req), dto);
  }

  @Post(':id/grants')
  @ApiOperation({ summary: "Grant an existing user access to another school in this org" })
  addGrant(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateGrantDto,
  ) {
    return this.identity.createGrantForOrg(this.orgId(req), id, dto);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: "Reset a user's password" })
  resetPassword(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.identity.resetPasswordForOrg(this.orgId(req), id, dto);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: "List a user's login activity" })
  activity(@Req() req: Request, @Param('id') id: string) {
    return this.identity.listActivityForOrg(this.orgId(req), id);
  }
}
