import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

interface PropinasResponse {
  inicio: string;
  fin: string;
  acumulado: number;
}

interface JornadaEstadoApi {
  fecha: string;
}

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
  appliedStartDate = '';
  appliedEndDate = '';
  minStartDate = PROPINAS_BASE_DATE;
  maxStartDate = '';
  acumulado = 0;
  diario = 0;
  dailyDate = '';
  jornadaActiva = false;
  cargando = false;
  infoMessage = '';

  private wsUnsubscribe: (() => void) | null = null;
  private manualMode = false;
  private liveRefreshInFlight = false;
  private pendingLiveAccumulated = false;
  private pendingLiveDaily = false;

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit(): Promise<void> {
    this.maxStartDate = this.toISO(new Date());
    const periodoActual = this.current15DayPeriod();
    this.startDate = periodoActual.inicio;
    this.endDate = periodoActual.fin;
    this.appliedStartDate = periodoActual.inicio;
    this.appliedEndDate = periodoActual.fin;
    this.manualMode = false;
    await this.cargarDatos();
    void this.wsService.connect();
    this.suscribirActualizaciones();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribe?.();
    this.wsUnsubscribe = null;
  }

  onStartDateChange(): void {
    if (!this.startDate) {
      return;
    }
    this.ajustarPeriodoSeleccionado();
    this.infoMessage = '';
  }

  async consultarPropinas(): Promise<void> {
    this.ajustarPeriodoSeleccionado();
    const periodoActual = this.current15DayPeriod();
    this.manualMode =
      this.startDate !== periodoActual.inicio || this.endDate !== periodoActual.fin;
    this.appliedStartDate = this.startDate;
    this.appliedEndDate = this.endDate;
    await this.cargarDatos();
  }

  async limpiarFiltros(): Promise<void> {
    const periodoActual = this.current15DayPeriod();
    this.startDate = periodoActual.inicio;
    this.endDate = periodoActual.fin;
    this.appliedStartDate = periodoActual.inicio;
    this.appliedEndDate = periodoActual.fin;
    this.manualMode = false;
    this.infoMessage = '';
    await this.cargarDatos();
  }

  formatFecha(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  rangeLabel(): string {
    const inicio = this.appliedStartDate || this.startDate;
    const fin = this.appliedEndDate || this.endDate;
    if (!inicio || !fin) return 'Sin periodo definido';
    return `${this.formatFecha(inicio)} – ${this.formatFecha(fin)}`;
  }

  dailyStatusLabel(): string {
    if (!this.jornadaActiva || !this.dailyDate) {
      return 'Sin jornada abierta';
    }
    return `Jornada activa · ${this.formatFecha(this.dailyDate)}`;
  }

  isConsultarDisabled(): boolean {
    return this.cargando || !this.startDate || !this.endDate;
  }

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private suscribirActualizaciones(): void {
    const unsubscribePropinas = this.wsService.subscribe('/topic/propinas', (_event: any) => {
      this.marcarRefrescoEnVivo(true);
    });

    const unsubscribeJornada = this.wsService.subscribe('/topic/jornada', (_event: any) => {
      this.marcarRefrescoEnVivo(false);
    });

    this.wsUnsubscribe = () => {
      unsubscribePropinas();
      unsubscribeJornada();
    };
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

  private marcarRefrescoEnVivo(refreshAccumulated: boolean): void {
    if (refreshAccumulated && !this.manualMode) {
      this.pendingLiveAccumulated = true;
    }
    this.pendingLiveDaily = true;

    if (this.liveRefreshInFlight) {
      return;
    }
    void this.ejecutarRefrescoEnVivo();
  }

  private async ejecutarRefrescoEnVivo(): Promise<void> {
    if (this.liveRefreshInFlight) {
      return;
    }
    this.liveRefreshInFlight = true;
    try {
      while (this.pendingLiveAccumulated || this.pendingLiveDaily) {
        const shouldRefreshAccumulated = this.pendingLiveAccumulated;
        const shouldRefreshDaily = this.pendingLiveDaily;
        this.pendingLiveAccumulated = false;
        this.pendingLiveDaily = false;

        if (shouldRefreshAccumulated && !this.manualMode) {
          const periodoActual = this.current15DayPeriod();
          this.startDate = periodoActual.inicio;
          this.endDate = periodoActual.fin;
          this.appliedStartDate = periodoActual.inicio;
          this.appliedEndDate = periodoActual.fin;
          await this.cargarAcumulado(this.appliedStartDate, this.appliedEndDate);
        }

        if (shouldRefreshDaily) {
          await this.cargarPropinaDiaria();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.liveRefreshInFlight = false;
    }
  }

  private async cargarDatos(showLoading = true): Promise<void> {
    if (showLoading) {
      this.cargando = true;
      this.infoMessage = '';
    }

    try {
      const [acumuladoResult, diarioResult] = await Promise.allSettled([
        this.cargarAcumulado(this.appliedStartDate, this.appliedEndDate),
        this.cargarPropinaDiaria(),
      ]);

      if (acumuladoResult.status === 'rejected') {
        throw acumuladoResult.reason;
      }
      if (diarioResult.status === 'rejected') {
        console.error(diarioResult.reason);
      }
    } catch (err) {
      console.error(err);
      if (showLoading) {
        this.infoMessage = 'Error al cargar propinas.';
      }
    } finally {
      if (showLoading) {
        this.cargando = false;
      }
    }
  }

  private async cargarAcumulado(inicio: string, fin: string): Promise<void> {
    const periodo = await this.withTimeout(
      this.apiClient.get<PropinasResponse>(`/api/reportes/propinas?inicio=${inicio}&fin=${fin}`),
      10000,
      'Tiempo de espera agotado al consultar propinas acumuladas.'
    );
    this.appliedStartDate = this.isoDateKey(periodo?.inicio) || inicio;
    this.appliedEndDate = this.isoDateKey(periodo?.fin) || fin;
    this.acumulado = Number(periodo?.acumulado ?? 0);
  }

  private async cargarPropinaDiaria(): Promise<void> {
    const dailyDate = await this.resolveDailyDate();
    if (!dailyDate) {
      this.jornadaActiva = false;
      this.dailyDate = '';
      this.diario = 0;
      return;
    }

    this.jornadaActiva = true;
    this.dailyDate = dailyDate;
    const diario = await this.withTimeout(
      this.apiClient.get<PropinasResponse>(`/api/reportes/propinas?inicio=${dailyDate}&fin=${dailyDate}`),
      10000,
      'Tiempo de espera agotado al consultar propina diaria.'
    );
    this.diario = Number(diario?.acumulado ?? 0);
  }

  private async resolveDailyDate(): Promise<string | null> {
    try {
      const jornada = await this.withTimeout(
        this.apiClient.get<JornadaEstadoApi>('/api/operacion/jornadas/estado'),
        6000,
        'Tiempo de espera agotado al consultar estado de jornada.'
      );
      const jornadaDate = this.isoDateKey(jornada?.fecha);
      if (jornadaDate) {
        return jornadaDate;
      }
    } catch {
      // Sin jornada abierta en este endpoint.
    }

    try {
      const jornada = await this.withTimeout(
        this.apiClient.get<JornadaEstadoApi>('/api/jornadas/estado'),
        6000,
        'Tiempo de espera agotado al consultar estado de jornada.'
      );
      const jornadaDate = this.isoDateKey(jornada?.fecha);
      if (jornadaDate) {
        return jornadaDate;
      }
    } catch {
      // Sin jornada abierta en endpoint alterno.
    }

    return null;
  }

  private ajustarPeriodoSeleccionado(): void {
    const periodo = this.periodoParaFecha(this.startDate || PROPINAS_BASE_DATE);
    this.startDate = periodo.inicio;
    this.endDate = periodo.fin;
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

  private isoDateKey(rawDate: string | undefined | null): string {
    return (rawDate ?? '').toString().slice(0, 10);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}
