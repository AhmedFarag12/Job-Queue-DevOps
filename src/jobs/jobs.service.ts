import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { Job, JobDocument } from './job.schema.js';
import { JobStatus } from './job-status.enum.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { ListJobsDto } from './dto/list-jobs.dto.js';

const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 1000;

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
    @InjectQueue('jobs') private readonly jobsQueue: Queue,
  ) {}

  async create(dto: CreateJobDto, userId: string) {
    const maxAttempts = dto.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    const job = await this.jobModel.create({
      name: dto.name,
      payload: dto.payload ?? {},
      maxAttempts,
      createdBy: new Types.ObjectId(userId),
    });

    const queueJob = await this.jobsQueue.add(
      dto.name,
      { jobId: job.id, payload: dto.payload ?? {} },
      {
        attempts: maxAttempts,
        backoff: { type: 'exponential', delay: BACKOFF_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    job.queueJobId = queueJob.id ?? null;
    await job.save();

    return job;
  }

  async findAll(userId: string, query: ListJobsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = {
      createdBy: new Types.ObjectId(userId),
    };
    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.jobModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.jobModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string, userId: string) {
    const job = await this.findOwnedJob(id, userId);
    return job;
  }

  async retry(id: string, userId: string) {
    const job = await this.findOwnedJob(id, userId);

    if (job.status !== JobStatus.FAILED) {
      throw new ForbiddenException('Only failed jobs can be retried');
    }

    const queueJob = await this.jobsQueue.add(
      job.name,
      { jobId: job.id, payload: job.payload },
      {
        attempts: job.maxAttempts,
        backoff: { type: 'exponential', delay: BACKOFF_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    job.status = JobStatus.PENDING;
    job.attemptsMade = 0;
    job.error = null;
    job.result = null;
    job.queueJobId = queueJob.id ?? null;
    await job.save();

    return job;
  }

  async remove(id: string, userId: string) {
    const job = await this.findOwnedJob(id, userId);

    if (job.queueJobId) {
      const queueJob = await this.jobsQueue.getJob(job.queueJobId);
      if (queueJob) {
        await queueJob.remove();
      }
    }

    await job.deleteOne();
  }

  private async findOwnedJob(id: string, userId: string) {
    const job = await this.jobModel.findById(id).exec();
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    if (job.createdBy.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this job');
    }
    return job;
  }
}
