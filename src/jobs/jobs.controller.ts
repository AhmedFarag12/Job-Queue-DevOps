import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/current-user.decorator.js';
import { JobsService } from './jobs.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { ListJobsDto } from './dto/list-jobs.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.create(dto, user.userId);
  }

  @Get()
  findAll(@Query() query: ListJobsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.findAll(user.userId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.findOne(id, user.userId);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.retry(id, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.remove(id, user.userId);
  }
}
