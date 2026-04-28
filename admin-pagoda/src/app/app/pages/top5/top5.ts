import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

interface ItemVentaApi {
  producto: {
    id: number;
    nombre: string;
    categoria: { nombre: string } | null;
  } | null;
  cantidad: number;
  precioUnitario: number;
}

interface TopProduct {
  rank: number;
  nombre: string;
  categoria: string;
  cantidad: number;
  total: number;
}

@Component({
  selector: 'app-top5',
  imports: [FormsModule],
  templateUrl: './top5.html',
  styleUrl: './top5.css',
})
export class Top5 implements OnInit {
  protected rangePreset: RangePreset = 'weekly';
  protected startDate = '';
  protected endDate = '';
  protected jornadas: JornadaApi[] = [];
  protected jornadasFiltradas: JornadaApi[] = [];
  protected topProducts: TopProduct[] = [];
  protected infoMessage = '';

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.applyPresetDates(this.rangePreset);
    await this.loadJornadas();
    this.changeDetector.detectChanges();
    await this.loadTop5();
  }

  protected async onPresetChange(): Promise<void> {
    if (this.rangePreset !== 'custom') {
      this.applyPresetDates(this.rangePreset);
    }
    this.applyJornadaFilter();
    await this.loadTop5();
  }

  protected async onDateRangeChange(): Promise<void> {
    this.rangePreset = 'custom';
    this.applyJornadaFilter();
    await this.loadTop5();
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

  private async loadTop5(): Promise<void> {
    this.infoMessage = '';
    this.topProducts = [];

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

      const itemsAgrupados = await Promise.all(
        ventas.map((venta) => this.apiClient.get<ItemVentaApi[]>(`/api/ventas/items/venta/${venta.id}`)),
      );
      const items = itemsAgrupados.flat();

      const grouped = new Map<string, Omit<TopProduct, 'rank'>>();
      for (const item of items) {
        if (!item.producto) {
          continue;
        }

        const key = `${item.producto.id}`;
        const nombre = item.producto.nombre;
        const categoria = item.producto.categoria?.nombre ?? 'Sin categoría';
        const cantidad = Number(item.cantidad ?? 0);
        const total = Number(item.precioUnitario ?? 0) * cantidad;

        const current = grouped.get(key);
        if (!current) {
          grouped.set(key, {
            nombre,
            categoria,
            cantidad,
            total,
          });
          continue;
        }

        grouped.set(key, {
          ...current,
          cantidad: current.cantidad + cantidad,
          total: current.total + total,
        });
      }

      this.topProducts = Array.from(grouped.values())
        .sort((a, b) => {
          if (b.total === a.total) {
            return b.cantidad - a.cantidad;
          }
          return b.total - a.total;
        })
        .slice(0, 5)
        .map((product, index) => ({ ...product, rank: index + 1 }));

      if (!this.topProducts.length) {
        this.infoMessage = 'No hay datos de top platillos para el rango seleccionado.';
      }
    } catch (error) {
      this.topProducts = [];
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar el reporte de top platillos.';
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
