import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'pagoda-token';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token || request.url.endsWith('/api/admin/login')) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
