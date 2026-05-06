import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

interface PropinasResponse {
  inicio: string;
  fin: string;
  acumulado: number;
}

@Component({
  selector: 'app-propinas',
  imports: [FormsModule],
  templateUrl: './propinas.html',
  styleUrl: './propinas.css',
})
export class PropinasComponent implements OnInit, OnDestroy {
  startDate = '';
  endDate = '';
  acumulado = 0;
  cargando = false;
  infoMessage = '';
  private wsSubscription: Subscription | null = null;
  private manualMode = false;

  constructor(
    private apiClient: ApiClientService,
    private wsService: WebSocketService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.cargarPeriodoActual();
    await this.wsService.connect();
    this.suscribirActualizaciones();
  }

  ngOnDestroy(): void {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
  }

  private async cargarPeriodoActual(): Promise<void> {
    this.cargando = true;
    this.infoMessage = '';
    this.manualMode = false;
    try {
      const data = await this.apiClient.get<PropinasResponse>('/api/reportes/propinas/actual');
      this.startDate = String(data.inicio).slice(0, 10);
      this.endDate = String(data.fin).slice(0, 10);
      this.acumulado = Number(data.acumulado ?? 0);
    } catch (err) {
      this.infoMessage = 'Error al cargar propinas.';
      console.error(err);
      this.acumulado = 0;
    } finally {
      this.cargando = false;
    }
  }

  private async cargarPropinas(): Promise<void> {
    this.cargando = true;
    this.infoMessage = '';
    try {
      const { inicio, fin } = this.normalizarRango();
      const data = await this.apiClient.get<PropinasResponse>(
        `/api/reportes/propinas?inicio=${inicio}&fin=${fin}`
      );
      this.startDate = String(data.inicio).slice(0, 10);
      this.endDate = String(data.fin).slice(0, 10);
      this.acumulado = Number(data.acumulado ?? 0);
    } catch (err) {
      this.infoMessage = 'Error al cargar propinas.';
      console.error(err);
      this.acumulado = 0;
    } finally {
      this.cargando = false;
    }
  }

  private suscribirActualizaciones(): void {
    this.wsSubscription = this.wsService.subscribe('/topic/propinas').subscribe({
      next: (event: any) => {
        if (this.manualMode || !event || !event.periodoInicio) {
          return;
        }
        const periodoInicio = String(event.periodoInicio).slice(0, 10);
        const periodoFin = this.shiftIsoDate(periodoInicio, 14);
        this.startDate = periodoInicio;
        this.endDate = periodoFin;
        this.acumulado = Number(event.acumulado ?? 0);
      },
      error: (err: any) => {
        console.error('Error suscripción propinas:', err);
      }
    });
  }

  onDateRangeChange(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }
    this.manualMode = true;
    void this.cargarPropinas();
  }

  formatFecha(iso: string): string {
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  rangeLabel(): string {
    if (!this.startDate || !this.endDate) return 'Sin periodo definido';
    return `${this.formatFecha(this.startDate)} – ${this.formatFecha(this.endDate)}`;
  }

  private toISO(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private shiftIsoDate(isoDate: string, days: number): string {
    const base = new Date(`${isoDate}T00:00:00`);
    base.setDate(base.getDate() + days);
    return this.toISO(base);
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

  fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
}
