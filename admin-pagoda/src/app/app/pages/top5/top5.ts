import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

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
export class Top5Component implements OnInit, OnDestroy {
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
  realtimeActivo = true;

  private wsUnsubscribe: (() => void) | null = null;

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly wsService: WebSocketService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.inicializarRangoGlobal();
    await this.aplicarFiltros();
    await this.wsService.connect();
    this.suscribirActualizaciones();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribe?.();
    this.wsUnsubscribe = null;
  }

  onPresetChange(): void {
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);

    if (this.rangePreset === 'weekly') {
      start = new Date(today);
      start.setDate(today.getDate() - 6);
    } else if (this.rangePreset === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
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

  async aplicarFiltros(): Promise<void> {
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

  onRealtimeToggleChange(): void {
    if (this.realtimeActivo) {
      void this.cargarTop5();
    }
  }

  private async inicializarRangoGlobal(): Promise<void> {
    try {
      const jornadas = await this.apiClient.get<JornadaApi[]>('/api/operacion/jornadas');
      const fechas = (jornadas || [])
        .map((j) => String(j.fecha).slice(0, 10))
        .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
        .sort((a, b) => a.localeCompare(b));

      if (fechas.length > 0) {
        this.minDate = fechas[0];
        this.maxDate = fechas[fechas.length - 1];
        this.startDate = this.minDate;
        this.endDate = this.maxDate;
        this.appliedStartDate = this.startDate;
        this.appliedEndDate = this.endDate;
        this.realtimeActivo = true;
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
    this.realtimeActivo = true;
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

  private suscribirActualizaciones(): void {
    this.wsUnsubscribe = this.wsService.subscribe('/topic/top5', (_event: any) => {
      if (!this.realtimeActivo) {
        return;
      }
      void this.cargarTop5();
    });
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
