import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/ui/toast.service';

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

  protected name = '';
  protected pin = '';

  constructor() {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate(['/ventas']);
    }
  }

  protected async submit(): Promise<void> {
    if (!/^\d{4,8}$/.test(this.pin.trim())) {
      this.toastService.error('El PIN debe tener entre 4 y 8 digitos.');
      return;
    }

    const loginResult = await this.authService.login(this.name, this.pin);

    if (!loginResult.ok) {
      this.toastService.error(loginResult.message);
      return;
    }

    this.pin = '';
    this.toastService.success('Sesion iniciada correctamente.');
    void this.router.navigate(['/ventas']);
  }
}
