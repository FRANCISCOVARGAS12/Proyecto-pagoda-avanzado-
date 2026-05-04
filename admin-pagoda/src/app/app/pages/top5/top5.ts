import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

type RangePreset = 'weekly' | 'monthly' | 'custom';
const TOP5_STATE_KEY = 'pagoda-top5-state';

interface PlatilloTop {
  nombre: string;
  categoria?: string;
  cantidadVendida: number;
  totalGenerado: number;
}

interface Top5State {
  rangePreset: RangePreset;
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-top5',
  imports: [FormsModule],
  templateUrl: './top5.html',
  styleUrl: './top5.css',
})
export class Top5Component implements OnInit {
  // Filtros de rango
  rangePreset: RangePreset = 'custom';
  startDate = '';
  endDate = '';

  // Datos
  top5: PlatilloTop[] = [];
  cargando = false;
  infoMessage = '';

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit() {
    if (!this.restoreState()) {
      // Inicializar rango: por defecto, el día de la jornada activa o hoy
      await this.inicializarRango();
    }
    await this.cargarTop5();
    this.suscribirActualizaciones();
  }

  // ------------------------------------------------------------
  // Rango de fechas
  // ------------------------------------------------------------
  private async inicializarRango() {
    try {
      const jornada = await this.apiClient.getOrNull<any>('/api/operacion/jornadas/estado');
      const fechaRef = jornada?.fecha?.slice(0, 10) ?? this.hoyISO();
      this.startDate = fechaRef;
      this.endDate = fechaRef;
      this.rangePreset = 'custom'; // se muestra como personalizado
    } catch {
      const hoy = this.hoyISO();
      this.startDate = hoy;
      this.endDate = hoy;
    }
    this.saveState();
  }

  onPresetChange() {
    if (this.rangePreset === 'weekly') {
      this.aplicarDias(-6);
    } else if (this.rangePreset === 'monthly') {
      this.aplicarDias(-29);
    }
    // si es 'custom', no tocamos las fechas
    this.saveState();
    void this.cargarTop5();
  }

  onDateRangeChange() {
    this.rangePreset = 'custom';
    this.saveState();
    void this.cargarTop5();
  }

  private aplicarDias(dias: number) {
    const fin = new Date();
    const inicio = new Date();
    inicio.setDate(fin.getDate() + dias);
    this.endDate = this.toISO(fin);
    this.startDate = this.toISO(inicio);
    this.saveState();
  }

  // ------------------------------------------------------------
  // Carga de datos
  // ------------------------------------------------------------
  private async cargarTop5() {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const { inicio, fin } = this.normalizarRango();
      // Endpoint que acepte inicio y fin. Ajusta la URL según tu API real.
      const url = `/api/reportes/platillos/top5?inicio=${inicio}&fin=${fin}`;
      this.top5 = await this.apiClient.get<PlatilloTop[]>(url);
      this.saveState();
    } catch (err) {
      this.infoMessage = 'Error al cargar el top 5.';
      console.error(err);
      this.top5 = [];
    } finally {
      this.cargando = false;
    }
  }

  // ------------------------------------------------------------
  // WebSocket (solo actualiza si el rango es un único día)
  // ------------------------------------------------------------
  private suscribirActualizaciones() {
    this.wsService.subscribe('/topic/top5', (event: any) => {
      // event: { fecha: '2026-05-01', top5: [...] }
      if (!event || !event.fecha) return;

      const fechaEvento = String(event.fecha).slice(0, 10);
      if (!this.isDateInRange(fechaEvento)) return;

      // Si el rango mostrado es un único día, podemos usar el payload directamente.
      if (this.startDate === this.endDate && this.startDate === fechaEvento && Array.isArray(event.top5)) {
        this.top5 = event.top5;
        return;
      }

      // Para rangos de varios días, recargar asegura agregados correctos.
      void this.cargarTop5();
    });
  }

  // ------------------------------------------------------------
  // Formateo de fechas (día/mes/año)
  // ------------------------------------------------------------
  formatFecha(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  rangeLabel(): string {
    if (!this.startDate || !this.endDate) return 'Sin rango definido';
    if (this.startDate === this.endDate) {
      return this.formatFecha(this.startDate);
    }
    return `${this.formatFecha(this.startDate)} a ${this.formatFecha(this.endDate)}`;
  }

  // ------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------
  private hoyISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private toISO(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
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

  private isDateInRange(isoDate: string): boolean {
    const start = this.startDate <= this.endDate ? this.startDate : this.endDate;
    const end = this.endDate >= this.startDate ? this.endDate : this.startDate;
    return Boolean(isoDate && start && end && isoDate >= start && isoDate <= end);
  }

  private restoreState(): boolean {
    try {
      const raw = localStorage.getItem(TOP5_STATE_KEY);
      if (!raw) return false;

      const state = JSON.parse(raw) as Partial<Top5State>;
      if (!state.startDate || !state.endDate || !this.isIsoDate(state.startDate) || !this.isIsoDate(state.endDate)) {
        return false;
      }

      this.startDate = state.startDate;
      this.endDate = state.endDate;
      this.rangePreset =
        state.rangePreset === 'weekly' || state.rangePreset === 'monthly' || state.rangePreset === 'custom'
          ? state.rangePreset
          : 'custom';
      return true;
    } catch {
      return false;
    }
  }

  private saveState(): void {
    try {
      const state: Top5State = {
        rangePreset: this.rangePreset,
        startDate: this.startDate,
        endDate: this.endDate,
      };
      localStorage.setItem(TOP5_STATE_KEY, JSON.stringify(state));
    } catch {
      // Ignora errores de storage para no bloquear la vista.
    }
  }

  private isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
