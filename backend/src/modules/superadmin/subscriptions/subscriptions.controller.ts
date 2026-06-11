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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperadminGuard } from '../../../common/guards/superadmin.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@ApiTags('superadmin/subscriptions')
@ApiBearerAuth('bearer')
@UseGuards(SuperadminGuard)
@Controller('superadmin/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all subscriptions' })
  list() {
    return this.subs.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by id' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subs.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a subscription' })
  create(@Body() dto: CreateSubscriptionDto) {
    return this.subs.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subscription' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subs.update(id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('immediate') immediate?: string,
  ) {
    return this.subs.cancel(id, immediate === 'true');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hard delete a subscription' })
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.subs.remove(id);
  }
}
