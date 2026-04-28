import { Routes } from '@angular/router';
import { Ventas } from './app/pages/ventas/ventas';
import { Top5 } from './app/pages/top5/top5';
import { MenuManagement } from './app/pages/menu-management/menu-management';
import { Propinas } from './app/pages/propinas/propinas';
import { Login } from './app/pages/login/login';
import { authGuard, adminGuard } from './app/core/auth/auth.guard';
import { Configuracion } from './app/pages/configuracion/configuracion';
import { Usuarios } from './app/pages/usuarios/usuarios';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: '', redirectTo: 'ventas', pathMatch: 'full' },
  { path: 'ventas', component: Ventas, canActivate: [adminGuard] },
  { path: 'top5', component: Top5, canActivate: [adminGuard] },
  { path: 'menu', component: MenuManagement, canActivate: [adminGuard] },
  { path: 'propinas', component: Propinas, canActivate: [adminGuard] },
  { path: 'configuracion', component: Configuracion, canActivate: [adminGuard] },
  { path: 'usuarios', component: Usuarios, canActivate: [adminGuard] },
  { path: '**', redirectTo: 'ventas' },
];
