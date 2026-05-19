import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';

type RangePreset = 'weekly' | 'monthly' | 'custom';

interface PlatilloTop {
  nombre: string;
  categoria?: string;
  cantidadVendida: number;
  totalGenerado: number;
}

interface JornadaApi {
  fecha: string;
}

interface SalesFlowPoint {
  fecha: string;
  totalVentas: number;
  totalTickets: number;
}

@Component({
  selector: 'app-top5',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './top5.html',
  styleUrl: './top5.css'
})
export class Top5Component implements OnInit {
  rangePreset: RangePreset = 'custom';
  startDate = '';
  endDate = '';
  minDate = '';
  maxDate = '';
  appliedStartDate = '';
  appliedEndDate = '';

  top5: PlatilloTop[] = [];
  salesFlow: SalesFlowPoint[] = [];
  totalFlowSales = 0;
  totalFlowTickets = 0;
  maxFlowSales = 0;
  cargando = false;
  error = '';

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.inicializarRangoGlobal();
    await this.consultarTop5();
  }

  onPresetChange(): void {
    const referenceDate = this.parseIsoDate(this.maxDate || this.toISO(new Date()));
    let start = new Date(referenceDate);
    let end = new Date(referenceDate);

    if (this.rangePreset === 'weekly') {
      start = new Date(referenceDate);
      start.setDate(referenceDate.getDate() - 6);
    } else if (this.rangePreset === 'monthly') {
      start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
    }

    if (this.rangePreset !== 'custom') {
      this.startDate = this.clampDate(this.toISO(start));
      this.endDate = this.clampDate(this.toISO(end));
    }
  }

  onDateRangeChange(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }
    this.rangePreset = 'custom';
    if (!this.isDateRangeInvalid()) {
      this.error = '';
    }
  }

  async consultarTop5(): Promise<void> {
    if (!this.startDate || !this.endDate) {
      this.top5 = [];
      this.error = 'Selecciona un rango de fechas válido.';
      return;
    }
    if (this.isDateRangeInvalid()) {
      this.top5 = [];
      this.salesFlow = [];
      this.error = '';
      return;
    }
    this.appliedStartDate = this.startDate;
    this.appliedEndDate = this.endDate;
    await this.cargarTop5();
  }

  async limpiarFiltros(): Promise<void> {
    if (!this.minDate || !this.maxDate) {
      return;
    }
    this.rangePreset = 'custom';
    this.startDate = this.minDate;
    this.endDate = this.maxDate;
    this.appliedStartDate = this.minDate;
    this.appliedEndDate = this.maxDate;
    await this.cargarTop5();
  }

  isConsultarDisabled(): boolean {
    return this.cargando || !this.startDate || !this.endDate || this.isDateRangeInvalid();
  }

  isDateRangeInvalid(): boolean {
    return Boolean(this.startDate && this.endDate && this.endDate < this.startDate);
  }

  private async inicializarRangoGlobal(): Promise<void> {
    try {
      const jornadas = await this.apiClient.get<JornadaApi[]>('/api/operacion/jornadas');
      const fechas = (jornadas || [])
        .map((j) => String(j.fecha).slice(0, 10))
        .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
        .sort((a, b) => a.localeCompare(b));

      if (fechas.length > 0) {
        const today = this.toISO(new Date());
        const minFromData = fechas[0];
        const maxFromData = fechas[fechas.length - 1];

        this.maxDate = maxFromData > today ? today : maxFromData;
        this.minDate = minFromData > this.maxDate ? this.maxDate : minFromData;
        this.startDate = this.minDate;
        this.endDate = this.maxDate;
        this.appliedStartDate = this.startDate;
        this.appliedEndDate = this.endDate;
        return;
      }
    } catch {
      // fallback local si el endpoint falla
    }

    const hoy = this.toISO(new Date());
    this.minDate = hoy;
    this.maxDate = hoy;
    this.startDate = hoy;
    this.endDate = hoy;
    this.appliedStartDate = this.startDate;
    this.appliedEndDate = this.endDate;
  }

  private async cargarTop5(): Promise<void> {
    if (!this.appliedStartDate || !this.appliedEndDate) {
      this.top5 = [];
      return;
    }

    this.cargando = true;
    this.error = '';
    try {
      const [data, flow] = await Promise.all([
        this.apiClient.get<PlatilloTop[]>(
          `/api/reportes/platillos/top5?inicio=${this.appliedStartDate}&fin=${this.appliedEndDate}`,
        ),
        this.apiClient.get<SalesFlowPoint[]>(
          `/api/reportes/platillos/flujo-ventas?inicio=${this.appliedStartDate}&fin=${this.appliedEndDate}`,
        ),
      ]);
      this.top5 = [...(data || [])].sort((a, b) => b.totalGenerado - a.totalGenerado);
      this.salesFlow = this.fillFlowGaps(flow || [], this.appliedStartDate, this.appliedEndDate);
      this.totalFlowSales = this.salesFlow.reduce((sum, point) => sum + Number(point.totalVentas ?? 0), 0);
      this.totalFlowTickets = this.salesFlow.reduce((sum, point) => sum + Number(point.totalTickets ?? 0), 0);
      this.maxFlowSales = Math.max(0, ...this.salesFlow.map((point) => Number(point.totalVentas ?? 0)));
    } catch (err) {
      this.top5 = [];
      this.salesFlow = [];
      this.totalFlowSales = 0;
      this.totalFlowTickets = 0;
      this.maxFlowSales = 0;
      this.error = 'No se pudo cargar el Top 5.';
      console.error(err);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private toISO(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseIsoDate(isoDate: string): Date {
    const parsed = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  }

  private clampDate(isoDate: string): string {
    let normalized = isoDate;
    if (this.minDate && normalized < this.minDate) {
      normalized = this.minDate;
    }
    if (this.maxDate && normalized > this.maxDate) {
      normalized = this.maxDate;
    }
    return normalized;
  }

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  formatShortDate(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [, month, day] = iso.split('-');
    return `${day}/${month}`;
  }

  flowBarHeight(point: SalesFlowPoint): number {
    if (this.maxFlowSales <= 0) {
      return 6;
    }
    return Math.max(8, Math.round((Number(point.totalVentas ?? 0) / this.maxFlowSales) * 100));
  }

  top5BarWidth(product: PlatilloTop): number {
    const max = Math.max(0, ...this.top5.map((item) => Number(item.totalGenerado ?? 0)));
    if (max <= 0) {
      return 0;
    }
    return Math.max(8, Math.round((Number(product.totalGenerado ?? 0) / max) * 100));
  }

  private fillFlowGaps(points: SalesFlowPoint[], start: string, end: string): SalesFlowPoint[] {
    const normalized = points.map((point) => ({
      fecha: String(point.fecha ?? '').slice(0, 10),
      totalVentas: Number(point.totalVentas ?? 0),
      totalTickets: Number(point.totalTickets ?? 0),
    })).filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.fecha));
    const days = this.daysBetween(start, end);
    if (days < 0 || days > 45) {
      return normalized.sort((a, b) => a.fecha.localeCompare(b.fecha));
    }

    const byDate = new Map(normalized.map((point) => [point.fecha, point]));
    const filled: SalesFlowPoint[] = [];
    const cursor = this.parseIsoDate(start);
    for (let index = 0; index <= days; index++) {
      const fecha = this.toISO(cursor);
      filled.push(byDate.get(fecha) ?? { fecha, totalVentas: 0, totalTickets: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return filled;
  }

  private daysBetween(start: string, end: string): number {
    const startDate = this.parseIsoDate(start);
    const endDate = this.parseIsoDate(end);
    return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
  }
}
