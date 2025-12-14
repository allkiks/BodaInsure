import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

/**
 * Transform Interceptor
 * Wraps all successful responses in a consistent format
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: T) => {
        // If response already has data property, return as-is
        if (
          data &&
          typeof data === 'object' &&
          'data' in (data as object)
        ) {
          return data as unknown as ApiResponse<T>;
        }

        return { data };
      }),
    );
  }
}
