import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';

type RangePreset = 'weekly' | 'monthly' | 'custom';

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
export class Propinas implements OnInit {
  protected rangePreset: RangePreset = 'weekly';
  protected startDate = '';
  protected endDate = '';
  protected jornadas: JornadaApi[] = [];
  protected jornadasFiltradas: JornadaApi[] = [];
  protected totalPropinas = 0;
  protected infoMessage = '';

  constructor(private readonly apiClient: ApiClientService) {}

  async ngOnInit(): Promise<void> {
    this.applyPresetDates(this.rangePreset);
    await this.loadJornadas();
    await this.loadPropinas();
  }

  protected async onPresetChange(): Promise<void> {
    if (this.rangePreset !== 'custom') {
      this.applyPresetDates(this.rangePreset);
    }
    this.applyJornadaFilter();
    await this.loadPropinas();
  }

  protected async onDateRangeChange(): Promise<void> {
    this.rangePreset = 'custom';
    this.applyJornadaFilter();
    await this.loadPropinas();
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
      const jornadas = await this.apiClient.get<JornadaApi[]>('/api/operacion/jornadas');
      this.jornadas = [...jornadas].sort((a, b) => b.fecha.localeCompare(a.fecha));
      this.applyJornadaFilter();
    } catch (error) {
      this.jornadas = [];
      this.jornadasFiltradas = [];
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

  private applyPresetDates(preset: RangePreset): void {
    const today = new Date();
    const end = this.toIsoDate(today);
    const startDate = new Date(today);

    if (preset === 'weekly') {
      startDate.setDate(today.getDate() - 6);
    } else if (preset === 'monthly') {
      startDate.setDate(today.getDate() - 29);
    }

    this.endDate = end;
    this.startDate = this.toIsoDate(startDate);
  }

  private applyJornadaFilter(): void {
    const { start, end } = this.normalizedRange();
    this.jornadasFiltradas = this.jornadas.filter((jornada) => {
      if (!start || !end) {
        return true;
      }
      return jornada.fecha >= start && jornada.fecha <= end;
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
}
