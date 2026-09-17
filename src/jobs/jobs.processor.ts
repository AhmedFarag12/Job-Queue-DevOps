import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Job as BullJob } from 'bullmq';
import { Model } from 'mongoose';
import { Job, JobDocument } from './job.schema.js';
import { JobStatus } from './job-status.enum.js';

interface JobData {
  jobId: string;
  payload: Record<string, unknown>;
}

/**
 * Generic demo handler: the system accepts arbitrary job names/payloads from
 * the API, so there is no real business logic to run here. It simulates work
 * (optionally failing on request) so retries/backoff can be exercised end to
 * end. Replace this with real per-job-name handlers as they're added.
 */
@Processor('jobs')
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    @InjectModel(Job.name) private readonly jobModel: Model<JobDocument>,
  ) {
    super();
  }

  async process(job: BullJob<JobData>) {
    const { payload } = job.data;
    const delayMs =
      typeof payload?.delayMs === 'number' ? payload.delayMs : 200;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    if (payload?.simulateError) {
      throw new Error(
        typeof payload.simulateError === 'string'
          ? payload.simulateError
          : 'Simulated job failure',
      );
    }

    return { echo: payload };
  }

  @OnWorkerEvent('active')
  async onActive(job: BullJob<JobData>) {
    await this.jobModel
      .findByIdAndUpdate(job.data.jobId, {
        status: JobStatus.ACTIVE,
        attemptsMade: job.attemptsMade,
      })
      .exec();
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: BullJob<JobData>, result: unknown) {
    await this.jobModel
      .findByIdAndUpdate(job.data.jobId, {
        status: JobStatus.COMPLETED,
        result,
        error: null,
        attemptsMade: job.attemptsMade,
      })
      .exec();
  }

  @OnWorkerEvent('failed')
  async onFailed(job: BullJob<JobData> | undefined, error: Error) {
    if (!job) {
      this.logger.error(`Job failed without a job reference: ${error.message}`);
      return;
    }

    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    await this.jobModel
      .findByIdAndUpdate(job.data.jobId, {
        status: exhausted ? JobStatus.FAILED : JobStatus.PENDING,
        attemptsMade: job.attemptsMade,
        error: error.message,
      })
      .exec();
  }
}
