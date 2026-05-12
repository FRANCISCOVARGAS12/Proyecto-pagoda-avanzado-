import { Component, effect, inject, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiClientService } from './app/core/api/api-client.service';
import { AuthService } from './app/core/auth/auth.service';
import { Jornada, JornadaService } from './app/core/jornada/jornada.service';
import { AdminSettingsService } from './app/core/ui/admin-settings.service';
import { WebSocketService } from './app/core/websocket/websocket.service';
import { ToastContainer } from './app/shared/toast-container/toast-container';
import { ToastService } from './app/core/ui/toast.service';

const THEME_KEY = 'pagoda-theme';
const USER_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

interface VentaApi {
  id: number;
  fechaCierre: string | null;
}

interface PagoApi {
  metodoPago: { nombre: string } | null;
  monto: number;
  montoNeto: number;
  propinaMonto?: number;
  propinaNeto?: number;
}

interface ParametrosLocalApi {
  fondoLunes: number;
  comisionBancaria: number;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly apiClient = inject(ApiClientService);
  private readonly adminSettingsService = inject(AdminSettingsService);
  private readonly jornadaService = inject(JornadaService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly webSocketService = inject(WebSocketService);
  private jornadaTopicSubscribed = false;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private activityListenersRegistered = false;

  protected isDarkMode = false;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly displayName = this.authService.displayName;
  protected readonly jornadaAbierta = this.jornadaService.jornadaAbierta;

  constructor() {
    this.isDarkMode = this.getInitialTheme();
    this.applyTheme(this.isDarkMode);
    effect(() => {
      const authenticated = this.isAuthenticated();
      if (authenticated) {
        void this.initializeWebSocket();
        return;
      }

      this.jornadaTopicSubscribed = false;
      this.webSocketService.disconnect();
    });

    effect(() => {
      const authenticated = this.isAuthenticated();
      const inactivityMinutes = this.adminSettingsService.settings().autoLogoutMinutes;
      if (!authenticated) {
        this.stopInactivityTracking();
        return;
      }
      this.startInactivityTracking(inactivityMinutes);
    });
  }

  ngOnDestroy(): void {
    this.stopInactivityTracking();
    this.webSocketService.disconnect();
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      if (!this.webSocketService.isConnected()) {
        await this.webSocketService.connect();
      }

      if (!this.jornadaTopicSubscribed) {
        this.webSocketService.subscribe('/topic/jornada', (event: any) => {
          this.jornadaService.applyJornadaEvent(event);
        });
        this.jornadaTopicSubscribed = true;
      }

      await this.jornadaService.refreshCurrentJornada();
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
    const jornadaAbierta = this.jornadaAbierta();
    if (!jornadaAbierta) {
      return;
    }

    const result = await this.jornadaService.cerrarJornada();
    if (result.ok) {
      this.toastService.success(result.message);
      await this.generateCloseSummaryPdf(jornadaAbierta);
      return;
    }

    this.toastService.error(result.message);
  }

  protected logout(): void {
    this.stopInactivityTracking();
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

  private startInactivityTracking(minutes: number): void {
    if (!this.activityListenersRegistered) {
      USER_ACTIVITY_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, this.onUserActivity, { passive: true });
      });
      this.activityListenersRegistered = true;
    }

    this.scheduleInactivityLogout(minutes);
  }

  private stopInactivityTracking(): void {
    if (this.activityListenersRegistered) {
      USER_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, this.onUserActivity);
      });
      this.activityListenersRegistered = false;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private readonly onUserActivity = (): void => {
    this.scheduleInactivityLogout(this.adminSettingsService.settings().autoLogoutMinutes);
  };

  private scheduleInactivityLogout(minutes: number): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (!this.isAuthenticated() || !Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    this.inactivityTimer = setTimeout(() => {
      if (!this.isAuthenticated()) {
        return;
      }
      this.stopInactivityTracking();
      this.authService.logout();
      this.webSocketService.disconnect();
      this.toastService.error('Sesión cerrada por inactividad.');
      void this.router.navigate(['/login']);
    }, Math.round(minutes * 60_000));
  }

  private async generateCloseSummaryPdf(jornada: Jornada): Promise<void> {
    if (!this.adminSettingsService.snapshot().printSummaryOnClose) {
      return;
    }

    try {
      const ventas = await this.apiClient.get<VentaApi[]>(`/api/ventas/jornada/${jornada.id}`);
      const ventasCerradas = ventas.filter((venta) => Boolean(venta.fechaCierre));
      const pagosPorVenta = await Promise.all(
        ventasCerradas.map((venta) => this.apiClient.get<PagoApi[]>(`/api/ventas/pagos/venta/${venta.id}`)),
      );

      let totalEfectivo = 0;
      let totalTarjetaBruto = 0;
      let totalTarjetaNeto = 0;
      let totalPropinas = 0;

      pagosPorVenta.flat().forEach((pago) => {
        const metodo = (pago.metodoPago?.nombre ?? '').toLowerCase();
        const monto = Number(pago.monto ?? 0);
        const montoNeto = Number(pago.montoNeto ?? 0);
        const propinaBruta = Number(pago.propinaMonto ?? 0);
        const propinaNeta = Number(pago.propinaNeto ?? pago.propinaMonto ?? 0);
        const ventaBruta = Math.max(0, monto - propinaBruta);
        const ventaNeta = Math.max(0, montoNeto - propinaNeta);
        totalPropinas += Math.max(0, propinaNeta);

        if (metodo.includes('tarjeta')) {
          totalTarjetaBruto += ventaBruta;
          totalTarjetaNeto += ventaNeta;
          return;
        }
        totalEfectivo += ventaBruta;
      });

      let fondoInicial = 0;
      let comisionTarjeta = 0;
      try {
        const parametros = await this.apiClient.get<ParametrosLocalApi>('/api/operacion/parametros');
        fondoInicial = Number(parametros.fondoLunes ?? 0);
        comisionTarjeta = Number(parametros.comisionBancaria ?? 0);
      } catch {
        // No bloquea la generación del PDF si parámetros no están disponibles.
      }

      const totalVentas = totalEfectivo + totalTarjetaNeto;
      const settings = this.adminSettingsService.snapshot();
      const nowLabel = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      doc.setFontSize(18);
      doc.text(settings.receiptHeader, 14, 18);
      doc.setFontSize(11);
      doc.text(`Resumen de cierre de jornada #${jornada.id}`, 14, 28);
      doc.text(`Fecha jornada: ${jornada.fecha}`, 14, 35);
      doc.text(`Generado: ${nowLabel}`, 14, 42);

      doc.setFontSize(12);
      doc.text(`Fondo inicial: ${this.formatMoney(fondoInicial)}`, 14, 58);
      doc.text(`Ventas en efectivo: ${this.formatMoney(totalEfectivo)}`, 14, 67);
      doc.text(`Tarjeta bruto: ${this.formatMoney(totalTarjetaBruto)}`, 14, 76);
      doc.text(`Tarjeta neto: ${this.formatMoney(totalTarjetaNeto)}`, 14, 85);
      doc.text(`Total ventas (sin propinas): ${this.formatMoney(totalVentas)}`, 14, 98);
      doc.text(`Propinas netas: ${this.formatMoney(totalPropinas)}`, 14, 107);
      doc.text(`Pedidos cerrados: ${ventasCerradas.length}`, 14, 116);

      if (settings.showTicketCommission) {
        doc.text(`Comisión tarjeta aplicada: ${comisionTarjeta.toLocaleString('es-MX')}%`, 14, 125);
      }

      doc.setFontSize(10);
      doc.text(settings.receiptFooter, 14, 285);
      doc.save(`resumen-cierre-jornada-${jornada.id}.pdf`);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'No se pudo generar el PDF de cierre.';
      this.toastService.error(message);
    }
  }

  private formatMoney(value: number): string {
    return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
