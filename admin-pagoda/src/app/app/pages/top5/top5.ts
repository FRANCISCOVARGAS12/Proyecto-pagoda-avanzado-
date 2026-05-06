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
    await this.cargarTop5();
    await this.wsService.connect();
    this.suscribirActualizaciones();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribe?.();
    this.wsUnsubscribe = null;
  }

  async onPresetChange(): Promise<void> {
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
      this.startDate = this.toISO(start);
      this.endDate = this.toISO(end);
      this.realtimeActivo = false;
      await this.cargarTop5();
    }
  }

  async onDateRangeChange(): Promise<void> {
    if (!this.startDate || !this.endDate) {
      return;
    }
    this.rangePreset = 'custom';
    this.realtimeActivo = false;
    await this.cargarTop5();
  }

  async activarTiempoReal(): Promise<void> {
    if (!this.minDate || !this.maxDate) {
      await this.inicializarRangoGlobal();
    }
    this.startDate = this.minDate;
    this.endDate = this.maxDate;
    this.rangePreset = 'custom';
    this.realtimeActivo = true;
    await this.cargarTop5();
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
    this.realtimeActivo = true;
  }

  private async cargarTop5(): Promise<void> {
    if (!this.startDate || !this.endDate) {
      this.top5 = [];
      return;
    }

    const { inicio, fin } = this.normalizarRango();
    this.cargando = true;
    this.error = '';
    try {
      const data = await this.apiClient.get<PlatilloTop[]>(
        `/api/reportes/platillos/top5?inicio=${inicio}&fin=${fin}`,
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

  private normalizarRango(): { inicio: string; fin: string } {
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
