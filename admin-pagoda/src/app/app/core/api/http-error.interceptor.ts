import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

const TOKEN_INVALIDO_ERROR_CODE = 6009;

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const isLoginFlowRequest = [
        '/api/admin/login',
        '/api/admin/superuser/setup',
        '/api/admin/superuser/verify',
        '/api/auth/register-first-admin',
      ].some((path) => request.url.endsWith(path));
      const isAuthenticatedRequest = request.headers.has('Authorization');
      const apiError =
        error instanceof HttpErrorResponse
          ? (error.error as { errorCode?: number } | undefined)
          : undefined;
      const hasTokenExpired = apiError?.errorCode === TOKEN_INVALIDO_ERROR_CODE;
      const unknownAuthenticated401 =
        !apiError?.errorCode && isAuthenticatedRequest && !isLoginFlowRequest;

      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        (hasTokenExpired || unknownAuthenticated401)
      ) {
        authService.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
