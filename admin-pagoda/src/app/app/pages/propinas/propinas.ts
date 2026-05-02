import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

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

  // Periodo actual automático
  private periodoActualInicio = '';

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit() {
    this.setPeriodoActual();
    await this.cargarPropinas();
    this.suscribirActualizaciones();
  }

  // ----------------------------------------------------------
  // Cálculo del periodo actual de 15 días
  // ----------------------------------------------------------
  private setPeriodoActual() {
    const hoy = new Date();
    const dia = hoy.getDate();
    const offset = (dia - 1) % 15;
    const inicio = new Date(hoy);
    inicio.setDate(dia - offset);
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 14);

    this.startDate = this.toISO(inicio);
    this.endDate = this.toISO(fin);
    this.periodoActualInicio = this.startDate;
  }

  // ----------------------------------------------------------
  // Carga desde API
  // ----------------------------------------------------------
  private async cargarPropinas() {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const data = await this.apiClient.get<{ acumulado: number }>(
        `/api/reportes/propinas?inicio=${this.startDate}&fin=${this.endDate}`
      );
      this.acumulado = data.acumulado ?? 0;
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
      if (this.startDate === event.periodoInicio) {
        this.acumulado = event.acumulado;
      }
    });
  }

  // ----------------------------------------------------------
  // Botones rápido: periodo actual, anterior, siguiente
  // ----------------------------------------------------------
  irPeriodoActual() {
    this.setPeriodoActual();
    this.cargarPropinas();
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
    this.cargarPropinas();
  }

  // ----------------------------------------------------------
  // Al cambiar fechas manualmente
  // ----------------------------------------------------------
  onDateRangeChange() {
    this.cargarPropinas();
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

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
