import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { authTokenInterceptor } from './app/core/api/auth-token.interceptor';
import { httpErrorInterceptor } from './app/core/api/http-error.interceptor';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authTokenInterceptor, httpErrorInterceptor])),
    provideRouter(routes)
  ]
};
