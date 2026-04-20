import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { JornadaService } from '../../core/jornada/jornada.service';

interface ResumenPlatilloApi {
  producto: {
    id: number;
    nombre: string;
    categoria: {
      id: number;
      nombre: string;
    } | null;
  } | null;
  cantidadVendida: number;
  totalGenerado: number;
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
  protected startDate = '2026-02-24';
  protected endDate = '2026-03-02';
  protected topProducts: TopProduct[] = [];
  protected infoMessage = '';

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly jornadaService: JornadaService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadTop5();
  }

  protected fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  private async loadTop5(): Promise<void> {
    this.infoMessage = '';
    await this.jornadaService.refreshJornada();
    const jornada = this.jornadaService.jornadaAbierta();

    if (!jornada) {
      this.topProducts = [];
      this.infoMessage = 'No hay jornada activa para consultar reportes.';
      return;
    }

    try {
      const resumenes = await this.apiClient.get<ResumenPlatilloApi[]>(
        `/api/reportes/platillos-diarios/jornada/${jornada.id}`,
      );

      const grouped = new Map<number, Omit<TopProduct, 'rank'>>();

      for (const resumen of resumenes) {
        if (!resumen.producto) {
          continue;
        }

        const productId = resumen.producto.id;
        const current = grouped.get(productId);
        const nextCantidad = Number(resumen.cantidadVendida ?? 0);
        const nextTotal = Number(resumen.totalGenerado ?? 0);

        if (!current) {
          grouped.set(productId, {
            nombre: resumen.producto.nombre,
            categoria: resumen.producto.categoria?.nombre ?? 'Sin categoría',
            cantidad: nextCantidad,
            total: nextTotal,
          });
          continue;
        }

        grouped.set(productId, {
          ...current,
          cantidad: current.cantidad + nextCantidad,
          total: current.total + nextTotal,
        });
      }

      this.topProducts = Array.from(grouped.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map((product, index) => ({ ...product, rank: index + 1 }));

      if (!this.topProducts.length) {
        this.infoMessage = 'No hay datos de top platillos para la jornada activa.';
      }
    } catch (error) {
      this.topProducts = [];
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar el reporte de top platillos.';
    }
  }
}
