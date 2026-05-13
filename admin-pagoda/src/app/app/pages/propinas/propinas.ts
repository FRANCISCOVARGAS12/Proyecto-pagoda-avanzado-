import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

interface PropinasResponse {
  inicio: string;
  fin: string;
  acumulado: number;
}

interface JornadaEstadoApi {
  id: number;
  fecha: string;
  estado: string;
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
  // ── Fechas del periodo visible ────────────────────────────────
  startDate = '';
  endDate = '';
  minStartDate = PROPINAS_BASE_DATE;
  maxStartDate = '';

  // ── Datos mostrados ───────────────────────────────────────────
  acumulado = 0;         // Total del periodo de 15 días seleccionado
  diario = 0;            // Propinas de hoy (siempre el día actual)
  dailyDate = '';        // Fecha del diario (hoy)
  jornadaActiva = false; // Si hay jornada abierta ahora mismo

  // ── Estado ────────────────────────────────────────────────────
  cargando = false;
  cargandoDiario = false;
  infoMessage = '';

  // Modo manual = el usuario cambió el periodo manualmente
  // En este modo el acumulado NO se actualiza por WS, el diario SÍ
  private manualMode = false;

  private wsUnsub: (() => void) | null = null;

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.maxStartDate = this.toISO(new Date());

    // Siempre arrancar en el periodo actual de 15 días
    const actual = this.periodoActual();
    this.startDate = actual.inicio;
    this.endDate = actual.fin;
    this.manualMode = false;

    // Cargar todo en paralelo
    await Promise.all([
      this.cargarAcumulado(),
      this.cargarDiario(),
    ]);

    void this.wsService.connect();
    this.suscribirWS();
  }

  ngOnDestroy(): void {
    this.wsUnsub?.();
    this.wsUnsub = null;
  }

  // ── Handlers de UI ───────────────────────────────────────────

  onStartDateChange(): void {
    if (!this.startDate) return;
    // Calcular el bloque de 15 días que contiene la fecha elegida
    const periodo = this.periodoParaFecha(this.startDate);
    this.startDate = periodo.inicio;
    this.endDate = periodo.fin;
  }

  async consultarPropinas(): Promise<void> {
    // Verificar si el periodo elegido es el actual
    const actual = this.periodoActual();
    this.manualMode = this.startDate !== actual.inicio || this.endDate !== actual.fin;
    await this.cargarAcumulado();
  }

  async limpiarFiltros(): Promise<void> {
    const actual = this.periodoActual();
    this.startDate = actual.inicio;
    this.endDate = actual.fin;
    this.manualMode = false;
    this.infoMessage = '';
    await this.cargarAcumulado();
  }

  // ── Carga de datos ───────────────────────────────────────────

  // Carga el acumulado del periodo visible (startDate–endDate)
  private async cargarAcumulado(): Promise<void> {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const data = await this.apiClient.get<PropinasResponse>(
        `/api/reportes/propinas?inicio=${this.startDate}&fin=${this.endDate}`
      );
      this.acumulado = Number(data?.acumulado ?? 0);
      // El backend puede ajustar las fechas — actualizar con las que devuelve
      if (data?.inicio) this.startDate = data.inicio.slice(0, 10);
      if (data?.fin)    this.endDate   = data.fin.slice(0, 10);
    } catch (err) {
      console.error('Error cargando acumulado:', err);
      this.infoMessage = 'Error al cargar propinas acumuladas.';
      this.acumulado = 0;
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // Carga las propinas de hoy + estado de jornada
  private async cargarDiario(): Promise<void> {
    this.cargandoDiario = true;
    try {
      // 1. Obtener fecha de la jornada activa (si existe)
      let fechaHoy = '';
      let hayJornadaActiva = false;
      try {
        const jornada = await this.apiClient.get<JornadaEstadoApi>(
          '/api/operacion/jornadas/estado'
        );
        if (jornada?.fecha) {
          fechaHoy = jornada.fecha.slice(0, 10);
          hayJornadaActiva = true;
        } else {
          hayJornadaActiva = false;
        }
      } catch {
        // 404 = sin jornada abierta
        hayJornadaActiva = false;
      }

      this.jornadaActiva = hayJornadaActiva;
      if (!hayJornadaActiva || !fechaHoy) {
        this.dailyDate = '';
        this.diario = 0;
        return;
      }

      this.dailyDate = fechaHoy;

      // 2. Consultar propinas de ese día
      const data = await this.apiClient.get<PropinasResponse>(
        `/api/reportes/propinas?inicio=${fechaHoy}&fin=${fechaHoy}`
      );
      this.diario = Number(data?.acumulado ?? 0);
    } catch (err) {
      console.error('Error cargando diario:', err);
      this.diario = 0;
    } finally {
      this.cargandoDiario = false;
      this.cdr.detectChanges();
    }
  }

  // ── WebSocket ────────────────────────────────────────────────

  private suscribirWS(): void {
    // Evento de propinas: un pedido cerrado con propina
    const unsubPropinas = this.wsService.subscribe('/topic/propinas', (event: any) => {
      // Siempre actualizar el diario (es hoy sin importar el modo)
      void this.cargarDiario();

      // Actualizar acumulado SOLO si no está en modo manual
      if (!this.manualMode) {
        // Verificar si el nuevo periodo activo cambió
        const actual = this.periodoActual();
        if (this.startDate !== actual.inicio) {
          // Cambió el periodo de 15 días → resetear al nuevo
          this.startDate = actual.inicio;
          this.endDate = actual.fin;
        }
        void this.cargarAcumulado();
      }
    });

    // Evento de jornada: abrió o cerró
    const unsubJornada = this.wsService.subscribe('/topic/jornada', (event: any) => {
      if (event?.accion === 'ABIERTA') {
        this.jornadaActiva = true;
        if (event?.jornada?.fecha) {
          this.dailyDate = event.jornada.fecha.slice(0, 10);
        }
        void this.cargarDiario();
      } else if (event?.accion === 'CERRADA') {
        this.jornadaActiva = false;
        void this.cargarDiario();
      }
      this.cdr.detectChanges();
    });

    this.wsUnsub = () => {
      unsubPropinas();
      unsubJornada();
    };
  }

  // ── Labels ───────────────────────────────────────────────────

  rangeLabel(): string {
    if (!this.startDate || !this.endDate) return 'Sin periodo definido';
    return `${this.formatFecha(this.startDate)} – ${this.formatFecha(this.endDate)}`;
  }

  dailyStatusLabel(): string {
    if (!this.jornadaActiva) return 'Sin jornada abierta';
    return `Jornada abierta · ${this.formatFecha(this.dailyDate)}`;
  }

  esPeriodoActual(): boolean {
    const actual = this.periodoActual();
    return this.startDate === actual.inicio && this.endDate === actual.fin;
  }

  isConsultarDisabled(): boolean {
    return this.cargando || !this.startDate || !this.endDate;
  }

  // ── Utilidades ───────────────────────────────────────────────

  formatFecha(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private periodoActual(): { inicio: string; fin: string } {
    return this.periodoParaFecha(this.toISO(new Date()));
  }

  private periodoParaFecha(isoDate: string): { inicio: string; fin: string } {
    const base = this.parseISO(PROPINAS_BASE_DATE);
    const max  = this.parseISO(this.maxStartDate || this.toISO(new Date()));
    let target = this.parseISO(isoDate);

    if (target < base) target = base;
    if (target > max)  target = max;

    const diffDays    = Math.floor((target.getTime() - base.getTime()) / 86400000);
    const blockOffset = Math.floor(diffDays / PROPINAS_PERIOD_DAYS) * PROPINAS_PERIOD_DAYS;

    const inicio = new Date(base);
    inicio.setDate(base.getDate() + blockOffset);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + PROPINAS_PERIOD_DAYS - 1);

    return { inicio: this.toISO(inicio), fin: this.toISO(fin) };
  }

  private toISO(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseISO(iso: string): Date {
    const d = new Date(`${iso}T00:00:00`);
    return isNaN(d.getTime()) ? new Date() : d;
  }
}
