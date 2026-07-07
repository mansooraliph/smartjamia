import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OrganizationGuard } from '../../../common/guards/organization.guard';
import { OrgPortalService } from './org-portal.service';
import { CreateSchoolDto } from '../schools/dto/create-school.dto';
import { CreateOrgGrantDto } from './dto/create-org-grant.dto';

/** Organization Admin portal — everything scoped to the token's organization. */
@ApiTags('org-portal')
@ApiBearerAuth('bearer')
@UseGuards(OrganizationGuard)
@Controller('org')
export class OrgPortalController {
  constructor(private readonly portal: OrgPortalService) {}

  private orgId(req: Request): string {
    return (req as any).user.organizationId;
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current organization (with school usage)' })
  me(@Req() req: Request) {
    return this.portal.me(this.orgId(req));
  }

  @Get('schools')
  @ApiOperation({ summary: "List the organization's schools" })
  listSchools(@Req() req: Request) {
    return this.portal.listSchools(this.orgId(req));
  }

  @Post('schools')
  @ApiOperation({ summary: 'Create a school (enforces the org school limit)' })
  createSchool(@Req() req: Request, @Body() dto: CreateSchoolDto) {
    return this.portal.createSchool(this.orgId(req), dto);
  }

  @Delete('schools/:id')
  @ApiOperation({ summary: 'Soft-delete a school in this organization' })
  removeSchool(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portal.removeSchool(this.orgId(req), id);
  }

  @Get('schools/:id/grants')
  @ApiOperation({ summary: "List a school's access grants" })
  listGrants(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portal.listGrants(this.orgId(req), id);
  }

  @Post('schools/:id/grants')
  @ApiOperation({ summary: 'Grant a user access to a school (by email + role)' })
  grant(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateOrgGrantDto,
  ) {
    return this.portal.grant(this.orgId(req), id, dto);
  }

  @Delete('grants/:id')
  @ApiOperation({ summary: 'Revoke a school-access grant' })
  revokeGrant(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.portal.revokeGrant(this.orgId(req), id);
  }
}
