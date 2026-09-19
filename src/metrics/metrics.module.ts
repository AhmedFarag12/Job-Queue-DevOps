import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { collectDefaultMetrics } from '@prometheus-io/client';
import { MetricsController } from './metrics.controller.js';
import { HttpMetricsMiddleware } from './http-metrics.middleware.js';

collectDefaultMetrics();

@Module({
  controllers: [MetricsController],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpMetricsMiddleware).forRoutes('*');
  }
}
