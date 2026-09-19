import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Histogram } from '@prometheus-io/client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = (req.route?.path as string) ?? req.path;

      httpRequestDuration.observe(
        { method: req.method, route, status_code: res.statusCode },
        durationSeconds,
      );
    });

    next();
  }
}
