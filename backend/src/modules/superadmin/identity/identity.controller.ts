import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { IdentityService } from './identity.service';
import {
  CreateGrantDto,
  CreateOrganizationAdminDto,
  CreateUserAccountDto,
  ResetPasswordDto,
} from './dto/identity.dto';

@ApiTags('superadmin/identity')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  // ─── User accounts (multi-school logins) ──────────────────────────────────
  @Get('user-accounts')
  @ApiOperation({ summary: 'List central login accounts' })
  listAccounts() {
    return this.identity.listAccounts();
  }

  @Post('user-accounts')
  @ApiOperation({ summary: 'Create a central login account' })
  createAccount(@Body() dto: CreateUserAccountDto) {
    return this.identity.createAccount(dto);
  }

  @Delete('user-accounts/:id')
  @ApiOperation({ summary: 'Delete an account (revokes all its school grants)' })
  removeAccount(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.identity.removeAccount(id);
  }

  // ─── School-access grants ─────────────────────────────────────────────────
  @Get('user-accounts/:id/grants')
  @ApiOperation({ summary: "List an account's school-access grants" })
  listGrants(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.identity.listGrants(id);
  }

  @Post('user-accounts/:id/grants')
  @ApiOperation({ summary: 'Grant an account access to a school (with a role)' })
  createGrant(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateGrantDto,
  ) {
    return this.identity.createGrant(id, dto);
  }

  @Delete('grants/:id')
  @ApiOperation({ summary: 'Revoke a school-access grant' })
  revokeGrant(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.identity.revokeGrant(id);
  }

  // ─── Organization admins ──────────────────────────────────────────────────
  @Get('organizations/:orgId/admins')
  @ApiOperation({ summary: "List an organization's admin logins" })
  listOrgAdmins(@Param('orgId', new ParseUUIDPipe()) orgId: string) {
    return this.identity.listOrgAdmins(orgId);
  }

  @Post('organizations/:orgId/admins')
  @ApiOperation({ summary: 'Create an organization admin login' })
  createOrgAdmin(
    @Param('orgId', new ParseUUIDPipe()) orgId: string,
    @Body() dto: CreateOrganizationAdminDto,
  ) {
    return this.identity.createOrgAdmin(orgId, dto);
  }

  @Delete('organization-admins/:id')
  @ApiOperation({ summary: 'Delete an organization admin login' })
  removeOrgAdmin(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.identity.removeOrgAdmin(id);
  }

  @Post('organization-admins/:id/reset-password')
  @ApiOperation({ summary: "Reset an organization admin's password" })
  resetOrgAdminPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.identity.resetOrgAdminPassword(id, dto);
  }
}
