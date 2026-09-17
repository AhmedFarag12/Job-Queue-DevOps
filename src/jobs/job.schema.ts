import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { JobStatus } from './job-status.enum.js';

export type JobDocument = HydratedDocument<Job>;

@Schema({ timestamps: true })
export class Job {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ type: String, enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Prop({ type: Object, default: null })
  result: unknown;

  @Prop({ type: String, default: null })
  error: string | null;

  @Prop({ default: 0 })
  attemptsMade: number;

  @Prop({ required: true, default: 3 })
  maxAttempts: number;

  @Prop({ type: String, default: null })
  queueJobId: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const JobSchema = SchemaFactory.createForClass(Job);
