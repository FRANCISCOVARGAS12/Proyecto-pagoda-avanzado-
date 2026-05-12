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
  }

  async consultarTop5(): Promise<void> {
    if (!this.startDate || !this.endDate) {
      this.top5 = [];
      this.error = 'Selecciona un rango de fechas válido.';
      return;
    }
    const { inicio, fin } = this.normalizarRango(this.startDate, this.endDate);
    this.startDate = inicio;
    this.endDate = fin;
    this.appliedStartDate = inicio;
    this.appliedEndDate = fin;
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
    return this.cargando || !this.startDate || !this.endDate;
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
      const data = await this.apiClient.get<PlatilloTop[]>(
        `/api/reportes/platillos/top5?inicio=${this.appliedStartDate}&fin=${this.appliedEndDate}`,
      );
      this.top5 = [...(data || [])].sort((a, b) => b.totalGenerado - a.totalGenerado);
    } catch (err) {
      this.top5 = [];
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

  private normalizarRango(inicio: string, fin: string): { inicio: string; fin: string } {
    if (inicio <= fin) {
      return { inicio, fin };
    }
    return { inicio: fin, fin: inicio };
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
}
