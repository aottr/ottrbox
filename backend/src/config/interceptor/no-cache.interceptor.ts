import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class NoCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        // Set headers to prevent caching by reverse proxies
        response.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, private",
        );
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Expires", "0");
      }),
    );
  }
}

