import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

type RangePreset = 'biweekly';
const BIWEEK_DAYS = 15;

interface JornadaApi {
  id: number;
  fecha: string;
  estado: 'ABIERTA' | 'CERRADA' | string;
}

interface VentaApi {
  id: number;
}

interface PagoApi {
  propinaMonto: number | null;
  propinaNeto: number | null;
}

@Component({
  selector: 'app-propinas',
  imports: [FormsModule],
  templateUrl: './propinas.html',
  styleUrl: './propinas.css',
})
export class Propinas implements OnInit, OnDestroy {
  protected rangePreset: RangePreset = 'biweekly';
  protected startDate = '';
  protected endDate = '';
  protected quincenaBaseDate = '';
  protected readonly todayIso = this.toIsoDate(new Date());
  protected jornadas: JornadaApi[] = [];
  protected jornadasFiltradas: JornadaApi[] = [];
  protected totalPropinas = 0;
  protected infoMessage = '';
  private syncingRange = false;
  private readonly webSocketService = inject(WebSocketService);

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    // Intentar cargar las propinas de la quincena actual automáticamente
    try {
      await this.loadPropinaQuincena();
    } catch {
      // Si falla la quincena, caer a la carga tradicional
      await this.loadJornadas();
      this.changeDetector.detectChanges();
      await this.loadPropinas();
    }
    this.subscribeToVentaEvents();
  }

  ngOnDestroy(): void {
    // WebSocket cleanup handled by service
  }

  private subscribeToVentaEvents(): void {
    if (this.webSocketService.isConnected()) {
      this.webSocketService.subscribe('/topic/ventas', async (event: any) => {
        if (event.event === 'VENTA_CERRADA') {
          console.log('📊 Venta cerrada - recargar propinas:', event);
          await this.loadJornadas();
          this.changeDetector.detectChanges();
          await this.loadPropinas();
        }
      });
    }
  }

  protected async onPresetChange(): Promise<void> {
    this.applyPresetDates(this.rangePreset);
    this.applyJornadaFilter();
    await this.loadPropinas();
  }

  protected async onDateRangeChange(source: 'start' | 'end'): Promise<void> {
    if (this.syncingRange) {
      return;
    }
    this.syncingRange = true;
    const sourceDate = source === 'start' ? this.startDate : this.endDate;
    const range = this.resolveQuincenaRange(sourceDate || this.startDate || this.endDate || this.todayIso);
    this.startDate = range.start;
    this.endDate = range.end;
    this.applyJornadaFilter();
    try {
      await this.loadPropinas();
    } finally {
      this.syncingRange = false;
    }
  }

  protected async goToPreviousPeriod(): Promise<void> {
    await this.shiftPeriod(-BIWEEK_DAYS);
  }

  protected async goToNextPeriod(): Promise<void> {
    await this.shiftPeriod(BIWEEK_DAYS);
  }

  protected canGoToPreviousPeriod(): boolean {
    if (!this.startDate || !this.quincenaBaseDate) {
      return false;
    }
    return this.startDate > this.quincenaBaseDate;
  }

  protected canGoToNextPeriod(): boolean {
    if (!this.startDate) {
      return false;
    }
    const currentRange = this.resolveQuincenaRange(this.todayIso);
    return this.startDate < currentRange.start;
  }

  protected rangeLabel(): string {
    const { start, end } = this.normalizedRange();
    if (!start || !end) {
      return 'Sin rango definido';
    }
    if (start === end) {
      return start;
    }
    return `${start} a ${end}`;
  }

  protected fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  private async loadJornadas(): Promise<void> {
    try {
      const [jornadas, jornadaAbierta] = await Promise.all([
        this.apiClient.get<JornadaApi[]>('/api/operacion/jornadas'),
        this.apiClient.getOrNull<JornadaApi>('/api/operacion/jornadas/estado'),
      ]);
      this.jornadas = [...jornadas].sort((a, b) => {
        const fechaA = this.normalizeDate(a.fecha);
        const fechaB = this.normalizeDate(b.fecha);
        if (fechaA === fechaB) {
          return b.id - a.id;
        }
        return fechaB.localeCompare(fechaA);
      });
      this.quincenaBaseDate = this.resolveQuincenaBaseDate(this.jornadas);
      
      // Prioridad: 1. Abierta, 2. Hoy, 3. Última jornada
      const referenceDate = 
        jornadaAbierta?.fecha ?? (this.jornadas.length ? this.jornadas[0].fecha : this.todayIso);
      
      this.applyPresetDates(this.rangePreset, referenceDate);
      this.applyJornadaFilter();
    } catch (error) {
      this.jornadas = [];
      this.jornadasFiltradas = [];
      this.quincenaBaseDate = this.todayIso;
      const range = this.resolveQuincenaRange(this.todayIso);
      this.startDate = range.start;
      this.endDate = range.end;
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar las jornadas.';
    }
  }

  private async loadPropinas(): Promise<void> {
    this.infoMessage = '';
    this.totalPropinas = 0;

    if (!this.jornadasFiltradas.length) {
      this.infoMessage = 'No hay jornadas en el rango seleccionado.';
      return;
    }

    try {
      const ventasAgrupadas = await Promise.all(
        this.jornadasFiltradas.map((jornada) =>
          this.apiClient.get<VentaApi[]>(`/api/ventas/jornada/${jornada.id}`),
        ),
      );
      const ventas = ventasAgrupadas.flat();

      if (!ventas.length) {
        this.infoMessage = 'No hay ventas registradas en el rango seleccionado.';
        return;
      }

      const pagosAgrupados = await Promise.all(
        ventas.map((venta) => this.apiClient.get<PagoApi[]>(`/api/ventas/pagos/venta/${venta.id}`)),
      );
      const pagos = pagosAgrupados.flat();

      this.totalPropinas = pagos.reduce(
        (accumulator, pago) =>
          accumulator +
          Number(
            pago.propinaNeto ?? pago.propinaMonto ?? 0,
          ),
        0,
      );

      if (!pagos.length) {
        this.infoMessage = 'No hay pagos registrados para el rango seleccionado.';
      }
    } catch (error) {
      this.totalPropinas = 0;
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar el reporte de propinas.';
    }
  }

  private applyPresetDates(_preset: RangePreset, referenceDate = this.todayIso): void {
    const range = this.resolveQuincenaRange(referenceDate);
    this.startDate = range.start;
    this.endDate = range.end;
  }

  private applyJornadaFilter(): void {
    const { start, end } = this.normalizedRange();
    this.jornadasFiltradas = this.jornadas.filter((jornada) => {
      if (!start || !end) {
        return true;
      }
      const jornadaDate = this.normalizeDate(jornada.fecha);
      return jornadaDate >= start && jornadaDate <= end;
    });
  }

  private normalizedRange(): { start: string; end: string } {
    let start = this.startDate;
    let end = this.endDate;
    if (start && end && start > end) {
      [start, end] = [end, start];
    }
    return { start, end };
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private resolveQuincenaBaseDate(jornadas: JornadaApi[]): string {
    if (!jornadas.length) {
      return this.todayIso;
    }
    return [...jornadas]
      .sort((a, b) => {
        const fechaA = this.normalizeDate(a.fecha);
        const fechaB = this.normalizeDate(b.fecha);
        if (fechaA === fechaB) {
          return a.id - b.id;
        }
        return fechaA.localeCompare(fechaB);
      })[0]
      .fecha
      .slice(0, 10);
  }

  private resolveQuincenaRange(referenceDate: string): { start: string; end: string } {
    const base = this.parseIsoDate(this.quincenaBaseDate || referenceDate || this.todayIso);
    const candidate = this.parseIsoDate(referenceDate || this.todayIso);
    const safeCandidate = candidate < base ? base : candidate;
    const diffDays = Math.floor((safeCandidate.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
    const blockStart = this.addDays(base, Math.floor(diffDays / BIWEEK_DAYS) * BIWEEK_DAYS);
    const blockEnd = this.addDays(blockStart, BIWEEK_DAYS - 1);
    return {
      start: this.toIsoDate(blockStart),
      end: this.toIsoDate(blockEnd),
    };
  }

  private async shiftPeriod(deltaDays: number): Promise<void> {
    if (!this.startDate) {
      return;
    }
    const moved = this.addDays(this.parseIsoDate(this.startDate), deltaDays);
    const range = this.resolveQuincenaRange(this.toIsoDate(moved));
    this.startDate = range.start;
    this.endDate = range.end;
    this.applyJornadaFilter();
    await this.loadPropinas();
  }

  private parseIsoDate(value: string): Date {
    const normalizedValue = this.normalizeDate(value);
    const parsed = new Date(`${normalizedValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return new Date(`${this.todayIso}T00:00:00`);
    }
    return parsed;
  }

  private addDays(baseDate: Date, days: number): Date {
    const result = new Date(baseDate);
    result.setDate(result.getDate() + days);
    return result;
  }

  private normalizeDate(rawDate: string): string {
    return (rawDate ?? '').toString().slice(0, 10);
  }

  private async loadPropinaQuincena(): Promise<void> {
    try {
      const response = await this.apiClient.get<any>('/api/reportes/propinas-diarias/quincena');
      this.totalPropinas = Number(response.propinasQuincena ?? 0);
      
      // Aplicar los dates de la quincena actual
      const today = new Date();
      const dayOfMonth = today.getDate();
      if (dayOfMonth <= 15) {
        this.startDate = this.toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
        this.endDate = this.toIsoDate(new Date(today.getFullYear(), today.getMonth(), 15));
      } else {
        this.startDate = this.toIsoDate(new Date(today.getFullYear(), today.getMonth(), 16));
        this.endDate = this.toIsoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
      }
      
      this.infoMessage = '';
      this.changeDetector.detectChanges();
    } catch (error) {
      console.warn('Propinas quincenales no disponibles, usando carga tradicional');
      throw error;
    }
  }
}
