import { Component, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, LoginResponse } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { ApiClientService } from '../../core/api/api-client.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly apiClient = inject(ApiClientService);

  protected name = '';
  protected pin = '';
  protected needsSetup = signal(false);
  protected isLoading = signal(true);
  protected isSubmitting = signal(false);

  constructor() {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate(['/ventas']);
    }
    this.checkSetup();
  }

  private async checkSetup(): Promise<void> {
    try {
      const response = await this.apiClient.get<boolean>('/api/auth/check-setup');
      this.needsSetup.set(response);
    } catch (error) {
      console.error('Error checking setup:', error);
      this.needsSetup.set(false);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (this.isSubmitting()) return;
    
    if (this.needsSetup()) {
      // Register first admin
      if (!/^\d{6}$/.test(this.pin.trim())) {
        this.toastService.error('El PIN debe tener exactamente 6 digitos.');
        return;
      }
      if (!this.name.trim()) {
        this.toastService.error('El nombre es obligatorio.');
        return;
      }

      this.isSubmitting.set(true);
      try {
        const login = await this.apiClient.post<LoginResponse, { nombre: string; pin: string }>('/api/auth/register-first-admin', {
          nombre: this.name.trim(),
          pin: this.pin.trim(),
        });
        this.authService.setSession(login);
        this.toastService.success('Administrador registrado. Iniciando sesión...');
        this.pin = '';
        this.needsSetup.set(false);
        void this.router.navigate(['/ventas']);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al registrar admin.';
        this.toastService.error(message);
      } finally {
        this.isSubmitting.set(false);
      }
    } else {
      // Normal login
      if (!/^\d{6}$/.test(this.pin.trim())) {
        this.toastService.error('El PIN debe tener exactamente 6 digitos.');
        return;
      }

      this.isSubmitting.set(true);
      const loginResult = await this.authService.login(this.name, this.pin);

      if (!loginResult.ok) {
        this.toastService.error(loginResult.message);
        this.isSubmitting.set(false);
        return;
      }

      this.pin = '';
      this.toastService.success('Sesion iniciada correctamente.');
      void this.router.navigate(['/ventas']);
    }
  }
}
