import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateJobDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;
}
