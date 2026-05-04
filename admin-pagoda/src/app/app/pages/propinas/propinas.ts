import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

const PROPINAS_STATE_KEY = 'pagoda-propinas-state';

interface PropinasResponse {
  inicio: string;
  fin: string;
  acumulado: number;
}

interface PropinasState {
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-propinas',
  imports: [FormsModule],
  templateUrl: './propinas.html',
  styleUrl: './propinas.css',
})
export class PropinasComponent implements OnInit {
  startDate = '';      // ISO yyyy-mm-dd
  endDate = '';        // ISO yyyy-mm-dd
  acumulado = 0;
  cargando = false;
  infoMessage = '';

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit() {
    if (!this.restoreState()) {
      await this.cargarPeriodoActual();
    } else {
      await this.cargarPropinas();
    }
    this.suscribirActualizaciones();
  }

  // ----------------------------------------------------------
  // Cálculo del periodo actual de 15 días
  // ----------------------------------------------------------
  private async cargarPeriodoActual() {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const data = await this.apiClient.get<PropinasResponse>('/api/reportes/propinas/actual');
      this.startDate = String(data.inicio).slice(0, 10);
      this.endDate = String(data.fin).slice(0, 10);
      this.acumulado = Number(data.acumulado ?? 0);
      this.saveState();
    } catch (err) {
      this.infoMessage = 'Error al cargar propinas.';
      console.error(err);
      this.acumulado = 0;
    } finally {
      this.cargando = false;
    }
  }

  // ----------------------------------------------------------
  // Carga desde API
  // ----------------------------------------------------------
  private async cargarPropinas() {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const data = await this.apiClient.get<PropinasResponse>(
        `/api/reportes/propinas?inicio=${this.startDate}&fin=${this.endDate}`
      );
      this.startDate = String(data.inicio).slice(0, 10);
      this.endDate = String(data.fin).slice(0, 10);
      this.acumulado = Number(data.acumulado ?? 0);
      this.saveState();
    } catch (err) {
      this.infoMessage = 'Error al cargar propinas.';
      console.error(err);
      this.acumulado = 0;
    } finally {
      this.cargando = false;
    }
  }

  // ----------------------------------------------------------
  // WebSocket – solo actualiza si el rango es el periodo actual
  // ----------------------------------------------------------
  private suscribirActualizaciones() {
    this.wsService.subscribe('/topic/propinas', (event: any) => {
      // event: { acumulado, periodoInicio }
      if (!event || !event.periodoInicio) return;
      const periodoInicio = String(event.periodoInicio).slice(0, 10);
      if (this.startDate === periodoInicio) {
        this.acumulado = Number(event.acumulado ?? 0);
      }
    });
  }

  // ----------------------------------------------------------
  // Botones rápido: periodo actual, anterior, siguiente
  // ----------------------------------------------------------
  irPeriodoActual() {
    void this.cargarPeriodoActual();
  }

  periodoAnterior() {
    this.desplazarPeriodo(-15);
  }

  periodoSiguiente() {
    this.desplazarPeriodo(15);
  }

  private desplazarPeriodo(dias: number) {
    const inicio = new Date(this.startDate + 'T00:00:00');
    inicio.setDate(inicio.getDate() + dias);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 14);
    this.startDate = this.toISO(inicio);
    this.endDate = this.toISO(fin);
    this.saveState();
    void this.cargarPropinas();
  }

  // ----------------------------------------------------------
  // Al cambiar fechas manualmente
  // ----------------------------------------------------------
  onDateRangeChange() {
    this.saveState();
    void this.cargarPropinas();
  }

  // ----------------------------------------------------------
  // Formato de fechas (día/mes/año)
  // ----------------------------------------------------------
  formatFecha(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  rangeLabel(): string {
    if (!this.startDate || !this.endDate) return 'Sin periodo definido';
    return `${this.formatFecha(this.startDate)} – ${this.formatFecha(this.endDate)}`;
  }

  // ----------------------------------------------------------
  // Utilidades
  // ----------------------------------------------------------
  private toISO(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private restoreState(): boolean {
    try {
      const raw = localStorage.getItem(PROPINAS_STATE_KEY);
      if (!raw) return false;

      const state = JSON.parse(raw) as Partial<PropinasState>;
      if (!state.startDate || !state.endDate || !this.isIsoDate(state.startDate) || !this.isIsoDate(state.endDate)) {
        return false;
      }

      this.startDate = state.startDate;
      this.endDate = state.endDate;
      return true;
    } catch {
      return false;
    }
  }

  private saveState(): void {
    try {
      const state: PropinasState = {
        startDate: this.startDate,
        endDate: this.endDate,
      };
      localStorage.setItem(PROPINAS_STATE_KEY, JSON.stringify(state));
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
