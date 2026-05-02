import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './app/core/auth/auth.service';
import { JornadaService } from './app/core/jornada/jornada.service';
import { WebSocketService } from './app/core/websocket/websocket.service';
import { ToastContainer } from './app/shared/toast-container/toast-container';
import { ToastService } from './app/core/ui/toast.service';

const THEME_KEY = 'pagoda-theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly jornadaService = inject(JornadaService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly webSocketService = inject(WebSocketService);

  protected isDarkMode = false;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly displayName = this.authService.displayName;
  protected readonly jornadaAbierta = this.jornadaService.jornadaAbierta;

  constructor() {
    this.isDarkMode = this.getInitialTheme();
    this.applyTheme(this.isDarkMode);
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.initializeWebSocket();
    }
  }

  ngOnDestroy(): void {
    this.webSocketService.disconnect();
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      await this.webSocketService.connect();

      this.webSocketService.subscribe('/topic/jornada', (event: any) => {
        this.jornadaService.applyJornadaEvent(event);
      });
    } catch (error) {
      console.error('Error conectando a WebSocket:', error);
    }
  }

  protected toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme(this.isDarkMode);
    this.saveTheme(this.isDarkMode);
  }

  protected async cerrarJornada(): Promise<void> {
    if (!this.jornadaAbierta()) {
      return;
    }

    const result = await this.jornadaService.cerrarJornada();
    if (result.ok) {
      this.toastService.success(result.message);
      return;
    }

    this.toastService.error(result.message);
  }

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }


  private getInitialTheme(): boolean {
    const savedTheme = this.readTheme();

    // Si hay preferencia guardada, usarla.
    if (savedTheme) {
      return savedTheme === 'dark';
    }

    // Si no hay preferencia guardada, respetar la del sistema.
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    return mediaQuery?.matches ?? false;
  }

  private applyTheme(isDarkMode: boolean): void {
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
  }

  private readTheme(): string | null {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  private saveTheme(isDarkMode: boolean): void {
    try {
      localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors; the UI theme still updates for this session.
    }
  }
}

