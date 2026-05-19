import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from '../ui/toast.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);
  const router = inject(Router);

  if (authService.isAuthenticated() && !authService.hasSuperuserSession()) {
    toastService.error('Verifica la contraseña de superusuario para entrar al panel.');
    authService.logout();
    return router.createUrlTree(['/login']);
  }

  if (authService.isAdmin()) {
    return true;
  }

  if (authService.isAuthenticated()) {
    toastService.error('Acceso denegado: Solo administradores pueden acceder.');
    authService.logout();
  }

  return router.createUrlTree(['/login']);
};
