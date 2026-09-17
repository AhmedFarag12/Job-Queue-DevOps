import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { Job, JobSchema } from './job.schema.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { JobsProcessor } from './jobs.processor.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    BullModule.registerQueue({ name: 'jobs' }),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsProcessor],
})
export class JobsModule {}
