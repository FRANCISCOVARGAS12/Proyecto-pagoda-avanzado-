import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

interface PropinasResponse {
  inicio: string;
  fin: string;
  acumulado: number;
}

@Component({
  selector: 'app-propinas',
  imports: [FormsModule],
  templateUrl: './propinas.html',
  styleUrl: './propinas.css',
})
export class PropinasComponent implements OnInit, OnDestroy {
  startDate = '';      // ISO yyyy-mm-dd
  endDate = '';        // ISO yyyy-mm-dd
  acumulado = 0;
  cargando = false;
  infoMessage = '';
  private wsUnsubscribe: (() => void) | null = null;

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit() {
    await this.cargarPeriodoActual();
    this.suscribirActualizaciones();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribe?.();
    this.wsUnsubscribe = null;
  }

  // ----------------------------------------------------------
  // Cálculo del periodo actual de 15 días
  // ----------------------------------------------------------
  private async cargarPeriodoActual() {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const data = await this.apiClient.get<PropinasResponse>('/api/reportes/propinas/actual');
      this.startDate = String(data.inicio).slice(0, 10);
      this.endDate = String(data.fin).slice(0, 10);
      this.acumulado = Number(data.acumulado ?? 0);
    } catch (err) {
      this.infoMessage = 'Error al cargar propinas.';
      console.error(err);
      this.acumulado = 0;
    } finally {
      this.cargando = false;
    }
  }

  // ----------------------------------------------------------
  // Carga desde API
  // ----------------------------------------------------------
  private async cargarPropinas() {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const { inicio, fin } = this.normalizarRango();
      const data = await this.apiClient.get<PropinasResponse>(
        `/api/reportes/propinas?inicio=${inicio}&fin=${fin}`
      );
      this.startDate = String(data.inicio).slice(0, 10);
      this.endDate = String(data.fin).slice(0, 10);
      this.acumulado = Number(data.acumulado ?? 0);
    } catch (err) {
      this.infoMessage = 'Error al cargar propinas.';
      console.error(err);
      this.acumulado = 0;
    } finally {
      this.cargando = false;
    }
  }

  // ----------------------------------------------------------
  // WebSocket – solo actualiza si el rango es el periodo actual
  // ----------------------------------------------------------
  private suscribirActualizaciones() {
    this.wsUnsubscribe = this.wsService.subscribe('/topic/propinas', (event: any) => {
      // event: { acumulado, periodoInicio }
      if (!event || !event.periodoInicio) return;

      if (!this.isCurrentPeriodSelected()) {
        return;
      }

      const periodoInicio = String(event.periodoInicio).slice(0, 10);
      const periodoFin = this.shiftIsoDate(periodoInicio, 14);
      this.startDate = periodoInicio;
      this.endDate = periodoFin;
      this.acumulado = Number(event.acumulado ?? 0);
    });
  }

  // ----------------------------------------------------------
  // Al cambiar fechas manualmente
  // ----------------------------------------------------------
  onDateRangeChange() {
    void this.cargarPropinas();
  }

  // ----------------------------------------------------------
  // Formato de fechas (día/mes/año)
  // ----------------------------------------------------------
  formatFecha(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  rangeLabel(): string {
    if (!this.startDate || !this.endDate) return 'Sin periodo definido';
    return `${this.formatFecha(this.startDate)} – ${this.formatFecha(this.endDate)}`;
  }

  isCurrentPeriodSelected(): boolean {
    if (!this.startDate || !this.endDate) {
      return false;
    }

    const current = this.current15DayPeriod();
    return this.startDate === current.inicio && this.endDate === current.fin;
  }

  // ----------------------------------------------------------
  // Utilidades
  // ----------------------------------------------------------
  private toISO(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private shiftIsoDate(isoDate: string, days: number): string {
    const base = new Date(`${isoDate}T00:00:00`);
    base.setDate(base.getDate() + days);
    return this.toISO(base);
  }

  private current15DayPeriod(): { inicio: string; fin: string } {
    const hoy = new Date();
    const inicio = new Date(hoy);
    const diaMes = hoy.getDate();
    const offset = (diaMes - 1) % 15;
    inicio.setDate(hoy.getDate() - offset);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 14);
    return { inicio: this.toISO(inicio), fin: this.toISO(fin) };
  }

  private normalizarRango(): { inicio: string; fin: string } {
    if (!this.startDate || !this.endDate) {
      return { inicio: this.startDate, fin: this.endDate };
    }

    if (this.startDate <= this.endDate) {
      return { inicio: this.startDate, fin: this.endDate };
    }

    const inicio = this.endDate;
    const fin = this.startDate;
    this.startDate = inicio;
    this.endDate = fin;
    return { inicio, fin };
  }

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
