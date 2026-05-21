import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, LoginResponse } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';
import { ApiClientService } from '../../core/api/api-client.service';

const LOGIN_CAROUSEL_IMAGES = [
  'WhatsApp Image 2026-05-19 at 11.58.13 AM(4).jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.13 AM(3).jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.12 AM(1).jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.12 AM(2).jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.12 AM(3).jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.12 AM.jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.13 AM.jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.13 AM(1).jpeg',
  'WhatsApp Image 2026-05-19 at 11.58.13 AM(2).jpeg',
].map((fileName) => ({
  src: `imagenes/${fileName}`,
  alt: '',
}));

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
  protected superPassword = '';
  protected superPasswordConfirm = '';
  protected superuserVerified = signal(false);
  protected superuserConfigured = signal(true);
  protected needsSetup = signal(false);
  protected isLoading = signal(true);
  protected isSubmitting = signal(false);
  protected readonly carouselImages = LOGIN_CAROUSEL_IMAGES;

  constructor() {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate(['/ventas']);
      return;
    }
    void this.initializeSuperuserGate();
  }

  private async initializeSuperuserGate(): Promise<void> {
    if (this.authService.hasSuperuserSession()) {
      this.superuserVerified.set(true);
      await this.checkSetup();
      return;
    }

    try {
      this.superuserConfigured.set(await this.authService.isSuperuserConfigured());
    } finally {
      this.isLoading.set(false);
    }
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

    if (!this.superuserVerified()) {
      await this.submitSuperuser();
      return;
    }
    
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
        const login = await this.apiClient.postWithHeaders<LoginResponse, { nombre: string; pin: string }>(
          '/api/auth/register-first-admin',
          {
            nombre: this.name.trim(),
            pin: this.pin.trim(),
          },
          this.authService.superuserHeaders(),
        );
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

  protected async submitSuperuser(): Promise<void> {
    if (this.isSubmitting()) return;

    if (!this.superuserConfigured() && this.superPassword !== this.superPasswordConfirm) {
      this.toastService.error('La confirmación de la contraseña no coincide.');
      return;
    }

    this.isSubmitting.set(true);
    try {
      const result = this.superuserConfigured()
        ? await this.authService.verifySuperuser(this.superPassword)
        : await this.authService.setupSuperuser(this.superPassword);
      if (!result.ok) {
        this.toastService.error(result.message);
        return;
      }

      this.superPassword = '';
      this.superPasswordConfirm = '';
      this.superuserConfigured.set(true);
      this.superuserVerified.set(true);
      this.toastService.success(result.message);
      await this.checkSetup();
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
