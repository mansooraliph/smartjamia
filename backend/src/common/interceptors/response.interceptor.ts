import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    ctx: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardResponse<T>> {
    const res = ctx.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        // File downloads (exports / PDFs) write directly to the response and
        // return nothing — never wrap them in the JSON envelope.
        if (res?.headersSent) {
          return data as unknown as StandardResponse<T>;
        }
        // If the controller already returned an envelope, leave it.
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as object)
        ) {
          return data as unknown as StandardResponse<T>;
        }
        return {
          success: true,
          data: data as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
