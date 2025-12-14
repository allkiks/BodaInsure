import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Logging Interceptor
 * Logs all incoming requests and their response times
 * Required per CLAUDE.md for audit and observability
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const userAgent = request.get('user-agent') ?? 'unknown';
    const now = Date.now();

    // Mask sensitive data in logs
    const maskedUrl = this.maskSensitiveParams(url);

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        this.logger.log(
          `${method} ${maskedUrl} - ${responseTime}ms - ${userAgent}`,
        );

        // Log warning if response time exceeds SLA (500ms for API)
        if (responseTime > 500) {
          this.logger.warn(
            `Slow response: ${method} ${maskedUrl} took ${responseTime}ms`,
          );
        }
      }),
    );
  }

  /**
   * Masks sensitive parameters in URLs
   * Per CLAUDE.md PII protection requirements
   */
  private maskSensitiveParams(url: string): string {
    // Mask phone numbers (show last 4)
    let masked = url.replace(
      /(\+?254|0)(7|1)\d{8}/g,
      (match) => `***${match.slice(-4)}`,
    );

    // Mask national IDs (show last 4)
    masked = masked.replace(/\d{8}/g, (match) =>
      match.length === 8 ? `****${match.slice(-4)}` : match,
    );

    return masked;
  }
}
