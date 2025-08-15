// src/app/core/interceptors/request-id.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { retry, timer, throwError } from 'rxjs';

export const requestIdInterceptor: HttpInterceptorFn = (req, next) => {
  const rid =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);

  const withId = req.clone({ setHeaders: { 'X-Request-ID': rid } });

  return next(withId).pipe(
    retry({
      count: 1,
      delay: (err, retryCount) => {
        if (err?.status >= 500) {
          return timer(300);
        }
        return throwError(() => err);
      },
    }),
  );
};
