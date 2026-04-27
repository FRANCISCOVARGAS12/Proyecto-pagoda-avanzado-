import { Injectable, signal } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export interface LoginResponse {
  usuarioId: number;
  nombre: string;
  rol: string;
  token: string;
}

const AUTH_KEY = 'pagoda-auth';
const USER_KEY = 'pagoda-user';
const TOKEN_KEY = 'pagoda-token';
const USER_ID_KEY = 'pagoda-user-id';
const ROLE_KEY = 'pagoda-role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authenticatedSignal = signal(false);
  private readonly displayNameSignal = signal('');
  private readonly userIdSignal = signal<number | null>(null);
  private readonly roleSignal = signal('');

  readonly isAuthenticated = this.authenticatedSignal.asReadonly();
  readonly displayName = this.displayNameSignal.asReadonly();
  readonly userId = this.userIdSignal.asReadonly();
  readonly role = this.roleSignal.asReadonly();

  constructor(private readonly apiClient: ApiClientService) {
    this.restoreSession();
  }

  async login(nombre: string, pin: string): Promise<{ ok: boolean; message: string }> {
    if (!nombre.trim() || !pin.trim()) {
      return { ok: false, message: 'Nombre y PIN son obligatorios.' };
    }

    try {
      const response = await this.apiClient.post<LoginResponse, { nombre: string; pin: string }>(
        '/api/admin/login',
        {
          nombre: nombre.trim(),
          pin: pin.trim(),
        },
      );

      this.setSession(response);

      return { ok: true, message: 'Login exitoso.' };
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'No se pudo iniciar sesion.';
      return { ok: false, message };
    }
  }

  logout(): void {
    this.authenticatedSignal.set(false);
    this.displayNameSignal.set('');
    this.userIdSignal.set(null);
    this.roleSignal.set('');
    this.clearSession();
  }

  setSession(login: LoginResponse): void {
    this.authenticatedSignal.set(true);
    this.displayNameSignal.set(login.nombre);
    this.userIdSignal.set(login.usuarioId);
    this.roleSignal.set(login.rol ?? '');
    this.saveSession(login);
  }

  private restoreSession(): void {
    const hasSession = localStorage.getItem(AUTH_KEY) === '1';
    const savedName = localStorage.getItem(USER_KEY) ?? '';
    const savedToken = localStorage.getItem(TOKEN_KEY) ?? '';
    const savedUserId = Number(localStorage.getItem(USER_ID_KEY));
    const savedRole = localStorage.getItem(ROLE_KEY) ?? '';

    if (!hasSession || !savedToken || !savedName || Number.isNaN(savedUserId)) {
      this.authenticatedSignal.set(false);
      this.displayNameSignal.set('');
      this.userIdSignal.set(null);
      this.roleSignal.set('');
      return;
    }

    this.authenticatedSignal.set(true);
    this.displayNameSignal.set(savedName);
    this.userIdSignal.set(savedUserId);
    this.roleSignal.set(savedRole);
  }

  private saveSession(login: LoginResponse): void {
    localStorage.setItem(AUTH_KEY, '1');
    localStorage.setItem(USER_KEY, login.nombre);
    localStorage.setItem(TOKEN_KEY, login.token);
    localStorage.setItem(USER_ID_KEY, `${login.usuarioId}`);
    localStorage.setItem(ROLE_KEY, login.rol ?? '');
  }

  private clearSession(): void {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(ROLE_KEY);
  }
}
