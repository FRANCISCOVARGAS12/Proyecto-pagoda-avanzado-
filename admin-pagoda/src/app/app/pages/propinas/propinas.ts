import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

interface PropinasResponse {
  inicio: string;
  fin: string;
  acumulado: number;
}

interface PropinasCache {
  inicio: string;
  fin: string;
  acumulado: number;
  manualMode: boolean;
}

const PROPINAS_CACHE_KEY = 'pagoda-propinas-cache';
const PROPINAS_BASE_DATE = '2026-04-26';
const PROPINAS_PERIOD_DAYS = 15;

@Component({
  selector: 'app-propinas',
  imports: [FormsModule],
  templateUrl: './propinas.html',
  styleUrl: './propinas.css',
})
export class PropinasComponent implements OnInit, OnDestroy {
  startDate = '';
  endDate = '';
  minStartDate = PROPINAS_BASE_DATE;
  maxStartDate = '';
  acumulado = 0;
  cargando = false;
  infoMessage = '';
  private wsUnsubscribe: (() => void) | null = null;
  private manualMode = false;

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit(): Promise<void> {
    this.maxStartDate = this.toISO(new Date());
    this.hydrateFromCache();
    if (!this.startDate || !this.endDate) {
      const periodoInicial = this.current15DayPeriod();
      this.startDate = periodoInicial.inicio;
      this.endDate = periodoInicial.fin;
    }
    this.ajustarPeriodoSeleccionado();
    await this.cargarPropinas();
    void this.wsService.connect();
    this.suscribirActualizaciones();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribe?.();
    this.wsUnsubscribe = null;
  }

  private suscribirActualizaciones(): void {
    this.wsUnsubscribe = this.wsService.subscribe('/topic/propinas', (_event: any) => {
      if (this.manualMode) {
        return;
      }

      void this.cargarPeriodoActual();
    });
  }

  onStartDateChange(): void {
    if (!this.startDate) {
      return;
    }

    this.ajustarPeriodoSeleccionado();
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

  private current15DayPeriod(): { inicio: string; fin: string } {
    return this.periodoParaFecha(this.toISO(new Date()));
  }

  private persistCache(): void {
    try {
      const payload: PropinasCache = {
        inicio: this.startDate,
        fin: this.endDate,
        acumulado: this.acumulado,
        manualMode: this.manualMode,
      };
      localStorage.setItem(PROPINAS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Ignora errores de storage para no bloquear el flujo.
    }
  }

  private hydrateFromCache(): void {
    try {
      const raw = localStorage.getItem(PROPINAS_CACHE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as Partial<PropinasCache>;
      if (!this.isIsoDate(parsed.inicio) || !this.isIsoDate(parsed.fin)) {
        return;
      }

      this.startDate = parsed.inicio;
      this.endDate = parsed.fin;
      const acumulado = Number(parsed.acumulado);
      if (Number.isFinite(acumulado)) {
        this.acumulado = acumulado;
      }
      this.manualMode = Boolean(parsed.manualMode);
    } catch {
      // Ignora caché inválida.
    }
  }

  private async cargarPeriodoActual(): Promise<void> {
    const periodoActual = this.current15DayPeriod();
    this.startDate = periodoActual.inicio;
    this.endDate = periodoActual.fin;
    this.manualMode = false;
    await this.cargarPropinas();
  }

  private async cargarPropinas(): Promise<void> {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const data = await this.apiClient.get<PropinasResponse>(
        `/api/reportes/propinas?inicio=${this.startDate}&fin=${this.endDate}`,
      );
      this.startDate = String(data.inicio).slice(0, 10);
      this.endDate = String(data.fin).slice(0, 10);
      this.acumulado = Number(data.acumulado ?? 0);
      this.persistCache();
    } catch (err) {
      this.infoMessage = 'Error al cargar propinas.';
      console.error(err);
    } finally {
      this.cargando = false;
    }
  }

  private ajustarPeriodoSeleccionado(): void {
    const periodo = this.periodoParaFecha(this.startDate || PROPINAS_BASE_DATE);
    this.startDate = periodo.inicio;
    this.endDate = periodo.fin;
    const periodoActual = this.current15DayPeriod();
    this.manualMode = this.startDate !== periodoActual.inicio || this.endDate !== periodoActual.fin;
  }

  private periodoParaFecha(isoDate: string): { inicio: string; fin: string } {
    const fechaBase = this.parseIsoDate(PROPINAS_BASE_DATE);
    const fechaMaxima = this.parseIsoDate(this.maxStartDate || this.toISO(new Date()));
    const seleccion = this.parseIsoDate(isoDate);

    let fechaObjetivo = seleccion;
    if (fechaObjetivo < fechaBase) {
      fechaObjetivo = fechaBase;
    }
    if (fechaObjetivo > fechaMaxima) {
      fechaObjetivo = fechaMaxima;
    }

    const diffMs = fechaObjetivo.getTime() - fechaBase.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const offsetBlocks = Math.floor(diffDays / PROPINAS_PERIOD_DAYS) * PROPINAS_PERIOD_DAYS;

    const inicio = new Date(fechaBase);
    inicio.setDate(fechaBase.getDate() + offsetBlocks);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + (PROPINAS_PERIOD_DAYS - 1));

    return { inicio: this.toISO(inicio), fin: this.toISO(fin) };
  }

  private parseIsoDate(isoDate: string): Date {
    const parsed = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  }

  private isIsoDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
