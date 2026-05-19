import { Injectable, signal } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export interface LoginResponse {
  usuarioId: number;
  nombre: string;
  rol: string;
  token: string;
}

export interface SuperuserSession {
  token: string;
  expiresAt: string;
}

const AUTH_KEY = 'pagoda-auth';
const USER_KEY = 'pagoda-user';
const TOKEN_KEY = 'pagoda-token';
const USER_ID_KEY = 'pagoda-user-id';
const ROLE_KEY = 'pagoda-role';
const SUPERUSER_TOKEN_KEY = 'pagoda-superuser-token';
const SUPERUSER_EXPIRES_KEY = 'pagoda-superuser-expires';
const SUPERUSER_HEADER = 'X-Superuser-Token';

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

  isAdmin(): boolean {
    return this.authenticatedSignal() && this.roleSignal() === 'ADMIN';
  }

  constructor(private readonly apiClient: ApiClientService) {
    this.restoreSession();
  }

  async isSuperuserConfigured(): Promise<boolean> {
    try {
      return await this.apiClient.get<boolean>('/api/admin/superuser/status');
    } catch {
      return true;
    }
  }

  async setupSuperuser(password: string): Promise<{ ok: boolean; message: string }> {
    if (password.trim().length < 8) {
      return { ok: false, message: 'La contraseña de superusuario debe tener al menos 8 caracteres.' };
    }

    try {
      const session = await this.apiClient.post<SuperuserSession, { password: string }>(
        '/api/admin/superuser/setup',
        { password: password.trim() },
      );
      this.saveSuperuserSession(session);
      return { ok: true, message: 'Superusuario configurado.' };
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo configurar el superusuario.';
      this.clearSuperuserSession();
      return { ok: false, message };
    }
  }

  async verifySuperuser(password: string): Promise<{ ok: boolean; message: string }> {
    if (!password.trim()) {
      return { ok: false, message: 'La contraseña de superusuario es obligatoria.' };
    }

    try {
      const session = await this.apiClient.post<SuperuserSession, { password: string }>(
        '/api/admin/superuser/verify',
        { password: password.trim() },
      );
      this.saveSuperuserSession(session);
      return { ok: true, message: 'Superusuario verificado.' };
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo verificar el superusuario.';
      this.clearSuperuserSession();
      return { ok: false, message };
    }
  }

  async login(nombre: string, pin: string): Promise<{ ok: boolean; message: string }> {
    if (!nombre.trim() || !pin.trim()) {
      return { ok: false, message: 'Nombre y PIN son obligatorios.' };
    }

    const superuserToken = this.getSuperuserToken();
    if (!superuserToken) {
      return { ok: false, message: 'Primero verifica la contraseña de superusuario.' };
    }

    try {
      const response = await this.apiClient.postWithHeaders<LoginResponse, { nombre: string; pin: string }>(
        '/api/admin/login',
        {
          nombre: nombre.trim(),
          pin: pin.trim(),
        },
        this.superuserHeaders(),
      );

      this.setSession(response);

      return { ok: true, message: 'Login exitoso.' };
    } catch (error) {
      let message =
        error instanceof Error && error.message ? error.message : 'No se pudo iniciar sesion.';
      if (message.trim().toLowerCase() === 'pin incorrecto') {
        message = 'Usuario o PIN incorrectos.';
      }
      return { ok: false, message };
    }
  }

  logout(): void {
    this.authenticatedSignal.set(false);
    this.displayNameSignal.set('');
    this.userIdSignal.set(null);
    this.roleSignal.set('');
    this.clearSession();
    this.clearSuperuserSession();
  }

  async verifyCurrentPin(pin: string): Promise<{ ok: boolean; message: string }> {
    if (!/^\d{6}$/.test(pin.trim())) {
      return { ok: false, message: 'El PIN debe tener exactamente 6 digitos.' };
    }

    try {
      await this.apiClient.post<boolean, { pin: string }>('/api/admin/verify-pin', {
        pin: pin.trim(),
      });
      return { ok: true, message: 'PIN verificado.' };
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'PIN incorrecto.';
      return { ok: false, message };
    }
  }

  getSuperuserToken(): string | null {
    try {
      const token = sessionStorage.getItem(SUPERUSER_TOKEN_KEY);
      const expiresAt = sessionStorage.getItem(SUPERUSER_EXPIRES_KEY);
      if (!token || !expiresAt) {
        return null;
      }
      const expiresTime = new Date(expiresAt).getTime();
      if (!Number.isFinite(expiresTime) || Date.now() >= expiresTime) {
        this.clearSuperuserSession();
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  hasSuperuserSession(): boolean {
    return Boolean(this.getSuperuserToken());
  }

  superuserHeaders(): Record<string, string> {
    const token = this.getSuperuserToken();
    return token ? { [SUPERUSER_HEADER]: token } : {};
  }

  setSession(login: LoginResponse): void {
    this.saveSession(login);
    this.authenticatedSignal.set(true);
    this.displayNameSignal.set(login.nombre);
    this.userIdSignal.set(login.usuarioId);
    this.roleSignal.set(login.rol ?? '');
  }

  private restoreSession(): void {
    const hasSession = localStorage.getItem(AUTH_KEY) === '1';
    const savedName = localStorage.getItem(USER_KEY) ?? '';
    const savedToken = localStorage.getItem(TOKEN_KEY) ?? '';
    const savedUserId = Number(localStorage.getItem(USER_ID_KEY));
    const savedRole = localStorage.getItem(ROLE_KEY) ?? '';

    if (!hasSession || !savedToken || !savedName || Number.isNaN(savedUserId) || !this.hasSuperuserSession()) {
      this.authenticatedSignal.set(false);
      this.displayNameSignal.set('');
      this.userIdSignal.set(null);
      this.roleSignal.set('');
      this.clearSession();
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

  private saveSuperuserSession(session: SuperuserSession): void {
    sessionStorage.setItem(SUPERUSER_TOKEN_KEY, session.token);
    sessionStorage.setItem(SUPERUSER_EXPIRES_KEY, session.expiresAt);
  }

  private clearSuperuserSession(): void {
    sessionStorage.removeItem(SUPERUSER_TOKEN_KEY);
    sessionStorage.removeItem(SUPERUSER_EXPIRES_KEY);
  }
}
