import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { SignupDto } from './dto/signup.dto';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly svc: PublicService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Active plans for the public pricing page' })
  plans() {
    return this.svc.activePlans();
  }

  @Post('signup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Self-service school signup — starts a free trial' })
  signup(@Body() dto: SignupDto) {
    return this.svc.signup(dto);
  }
}
