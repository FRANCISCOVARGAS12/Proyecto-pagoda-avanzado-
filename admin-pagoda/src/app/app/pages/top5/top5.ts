import { Component, OnInit } from '@angular/core';
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
    // Inicializar rango: por defecto, el día de la jornada activa o hoy
    await this.inicializarRango();
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
  }

  onPresetChange() {
    if (this.rangePreset === 'weekly') {
      this.aplicarDias(-6);
    } else if (this.rangePreset === 'monthly') {
      this.aplicarDias(-29);
    }
    // si es 'custom', no tocamos las fechas
    this.cargarTop5();
  }

  onDateRangeChange() {
    this.rangePreset = 'custom';
    this.cargarTop5();
  }

  private aplicarDias(dias: number) {
    const fin = new Date();
    const inicio = new Date();
    inicio.setDate(fin.getDate() + dias);
    this.endDate = this.toISO(fin);
    this.startDate = this.toISO(inicio);
  }

  // ------------------------------------------------------------
  // Carga de datos
  // ------------------------------------------------------------
  private async cargarTop5() {
    this.cargando = true;
    this.infoMessage = '';
    try {
      // Endpoint que acepte inicio y fin. Ajusta la URL según tu API real.
      const url = `/api/reportes/platillos/top5?inicio=${this.startDate}&fin=${this.endDate}`;
      this.top5 = await this.apiClient.get<PlatilloTop[]>(url);
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

      // Solo aplicar si el rango actual es EXACTAMENTE ese día
      if (this.startDate === event.fecha && this.endDate === event.fecha) {
        this.top5 = event.top5;
        console.log('📊 Top 5 actualizado en tiempo real');
      }
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

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
