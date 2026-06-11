import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SuperadminLoginDto } from './dto/superadmin-login.dto';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { ParentLoginDto, StudentLoginDto } from './dto/pin-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('superadmin/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Superadmin login (platform-level)' })
  @ApiResponse({
    status: 200,
    description: 'Returns access + refresh tokens and superadmin user.',
  })
  superadminLogin(@Body() dto: SuperadminLoginDto) {
    return this.auth.superadminLogin(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'School user login (tenant-level)' })
  @ApiResponse({
    status: 200,
    description: 'Returns access + refresh tokens, user, and school context.',
  })
  tenantLogin(@Body() dto: TenantLoginDto) {
    return this.auth.tenantLogin(dto.schoolCode, dto.email, dto.password);
  }

  @Post('student-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Student portal login (admission number + PIN)' })
  studentLogin(@Body() dto: StudentLoginDto) {
    return this.auth.studentLogin(dto.schoolCode, dto.admissionNumber, dto.pin);
  }

  @Post('parent-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Parent portal login (mobile + PIN)' })
  parentLogin(@Body() dto: ParentLoginDto) {
    return this.auth.parentLogin(dto.schoolCode, dto.mobile, dto.pin);
  }
}
