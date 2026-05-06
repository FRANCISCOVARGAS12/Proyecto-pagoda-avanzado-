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
  startDate = '';
  endDate = '';
  acumulado = 0;
  cargando = false;
  infoMessage = '';
  private wsUnsubscribe: (() => void) | null = null;
  private manualMode = false;
  private readonly requestTimeoutMs = 10000;

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit(): Promise<void> {
    const periodoInicial = this.current15DayPeriod();
    this.startDate = periodoInicial.inicio;
    this.endDate = periodoInicial.fin;
    await this.cargarPeriodoActual();
    void this.wsService.connect();
    this.suscribirActualizaciones();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribe?.();
    this.wsUnsubscribe = null;
  }

  private async cargarPeriodoActual(): Promise<void> {
    this.cargando = true;
    this.infoMessage = '';
    this.manualMode = false;
    try {
      const data = await this.withTimeout(
        this.apiClient.get<PropinasResponse>('/api/reportes/propinas/actual'),
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

  private async cargarPropinas(): Promise<void> {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const { inicio, fin } = this.normalizarRango();
      const data = await this.withTimeout(
        this.apiClient.get<PropinasResponse>(`/api/reportes/propinas?inicio=${inicio}&fin=${fin}`)
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

  private suscribirActualizaciones(): void {
    this.wsUnsubscribe = this.wsService.subscribe('/topic/propinas', (event: any) => {
      if (this.manualMode) {
        return;
      }

      const periodoInicio = typeof event?.periodoInicio === 'string'
        ? String(event.periodoInicio).slice(0, 10)
        : '';

      if (periodoInicio) {
        this.startDate = periodoInicio;
        this.endDate = this.shiftIsoDate(periodoInicio, 14);
      }

      const acumulado = Number(event?.acumulado);
      if (Number.isFinite(acumulado)) {
        this.acumulado = acumulado;
        return;
      }

      void this.cargarPeriodoActual();
    });
  }

  onDateRangeChange(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    const periodoActual = this.current15DayPeriod();
    if (this.startDate === periodoActual.inicio && this.endDate === periodoActual.fin) {
      this.manualMode = false;
      void this.cargarPeriodoActual();
      return;
    }

    this.manualMode = true;
    void this.cargarPropinas();
  }

  formatFecha(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  rangeLabel(): string {
    if (!this.startDate || !this.endDate) return 'Sin periodo definido';
    return `${this.formatFecha(this.startDate)} – ${this.formatFecha(this.endDate)}`;
  }

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

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo de espera agotado para propinas.')), this.requestTimeoutMs);
      }),
    ]);
  }

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
