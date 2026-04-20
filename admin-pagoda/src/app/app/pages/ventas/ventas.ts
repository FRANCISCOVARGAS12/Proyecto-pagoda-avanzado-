import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { JornadaService } from '../../core/jornada/jornada.service';

interface DishItem {
  nombre: string;
  precio: number;
}

interface OrderRow {
  id: string;
  mesa: string;
  pedido: number;
  totalBruto: number;
  totalNeto: number;
  tipoPago: 'efectivo' | 'tarjeta' | 'mixto';
  efectivoAmount?: number;
  tarjetaBruto?: number;
  tarjetaNeto?: number;
  dishes: DishItem[];
}

interface ResumenVentasApi {
  totalVentas: number;
  totalEfectivo: number;
  totalTarjetaBruto: number;
  totalTarjetaNeto: number;
}

interface ParametrosLocalApi {
  fondoLunes: number;
  fondoMartes: number;
  fondoMiercoles: number;
  fondoJueves: number;
  fondoViernes: number;
  fondoSabado: number;
  fondoDomingo: number;
}

interface VentaApi {
  id: number;
  mesa: { numero: number } | null;
  jornada: { id: number } | null;
  totalCuenta: number;
}

interface ItemVentaApi {
  id: number;
  producto: { nombre: string } | null;
  precioUnitario: number;
  cantidad: number;
}

interface PagoApi {
  id: number;
  metodoPago: { nombre: string } | null;
  monto: number;
  montoNeto: number;
}

@Component({
  selector: 'app-ventas',
  imports: [FormsModule],
  templateUrl: './ventas.html',
  styleUrl: './ventas.css',
})
export class Ventas implements OnInit {
  protected dateRange = 'Daily';
  protected totalVentas = 0;
  protected fondoInicial = 2000;
  protected totalEfectivo = 0;
  protected totalTarjetaBruto = 0;
  protected totalTarjetaNeto = 0;
  protected infoMessage = '';
  protected ordersData: OrderRow[] = [];

  private readonly expandedOrders = new Set<string>();

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly jornadaService: JornadaService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadResumenVentas();
  }

  protected async exportPdf(): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const generatedAt = new Date().toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const palette = {
      primary: [32, 64, 92] as const,
      primarySoft: [232, 240, 248] as const,
      accent: [76, 122, 164] as const,
      border: [220, 228, 236] as const,
      text: [30, 41, 59] as const,
      muted: [100, 116, 139] as const,
      page: [250, 251, 252] as const,
    };
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = 0;

    const ensureSpace = (neededHeight: number): void => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = 16;
      }
    };

    const addTextBlock = (text: string, options: { bold?: boolean; fontSize?: number; indent?: number; color?: typeof palette.text | typeof palette.muted } = {}): void => {
      const fontSize = options.fontSize ?? 10;
      const indent = options.indent ?? 0;
      const lineHeight = fontSize * 0.45 + 2;
      const color = options.color ?? palette.text;

      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);

      const lines = doc.splitTextToSize(text, contentWidth - indent) as string[];
      ensureSpace(lines.length * lineHeight + 2);
      doc.text(lines, margin + indent, y);
      y += lines.length * lineHeight + 2;
    };

    const drawHeader = (): void => {
      doc.setFillColor(...palette.primarySoft);
      doc.rect(0, 0, pageWidth, 34, 'F');

      doc.setFillColor(...palette.primary);
      doc.rect(0, 0, pageWidth, 4.5, 'F');

      doc.setTextColor(...palette.text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('Pagoda', margin, 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...palette.muted);
      doc.text('Reporte de ventas', margin, 21);
      doc.text(`Rango: ${this.dateRange}`, margin, 27);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...palette.primary);
      doc.text(this.fmt(this.totalVentas), pageWidth - margin, 18, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...palette.muted);
      doc.text('Total de ventas', pageWidth - margin, 24, { align: 'right' });

      y = 40;
    };

    const addSectionTitle = (title: string): void => {
      ensureSpace(14);
      doc.setFillColor(...palette.primarySoft);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...palette.primary);
      doc.text(title.toUpperCase(), margin + 3.5, y + 6.9);
      y += 13;
    };

    const addKeyValue = (label: string, value: string): void => {
      ensureSpace(10);
      doc.setDrawColor(...palette.border);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...palette.muted);
      doc.text(label, margin + 3.5, y + 6.1);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...palette.text);
      doc.text(value, pageWidth - margin - 3.5, y + 6.1, { align: 'right' });
      y += 11;
    };

    const addOrderBlock = (order: OrderRow): void => {
      const extraLines = order.tipoPago === 'mixto' ? 1 : 0;
      const estimatedHeight = 24 + order.dishes.length * 5 + extraLines * 4;
      ensureSpace(estimatedHeight);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...palette.border);
      doc.roundedRect(margin, y, contentWidth, estimatedHeight, 3, 3, 'FD');

      doc.setFillColor(...palette.accent);
      doc.rect(margin, y, 1.8, estimatedHeight, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...palette.text);
      doc.text(`${order.mesa} · Pedido ${order.pedido}`, margin + 4.5, y + 7.2);

      const paymentLabel =
        order.tipoPago === 'efectivo' ? 'Efectivo' : order.tipoPago === 'tarjeta' ? 'Tarjeta' : 'Mixto';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...palette.muted);
      doc.text(paymentLabel, margin + 4.5, y + 12.2);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...palette.primary);
      doc.text(this.fmt(order.totalNeto), pageWidth - margin - 4.5, y + 7.2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.muted);
      doc.text('Neto', pageWidth - margin - 4.5, y + 12.2, { align: 'right' });

      let innerY = y + 18;
      doc.setFontSize(9.5);
      doc.setTextColor(...palette.text);
      doc.text(`Pago: ${order.tipoPago} · Bruto: ${this.fmt(order.totalBruto)} · Neto: ${this.fmt(order.totalNeto)}`, margin + 4.5, innerY);
      innerY += 5;

      if (order.tipoPago === 'mixto') {
        doc.setTextColor(...palette.muted);
        doc.text(
          `Detalle mixto: efectivo ${this.fmt(order.efectivoAmount ?? 0)} + tarjeta ${this.fmt(order.tarjetaBruto ?? 0)} / ${this.fmt(order.tarjetaNeto ?? 0)}`,
          margin + 4.5,
          innerY,
        );
        innerY += 5;
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...palette.primary);
      doc.text('Platos', margin + 4.5, innerY);
      innerY += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...palette.text);
      for (const dish of order.dishes) {
        doc.text(`• ${dish.nombre}`, margin + 8, innerY);
        doc.text(this.fmt(dish.precio), pageWidth - margin - 4.5, innerY, { align: 'right' });
        innerY += 4.8;
      }

      y += estimatedHeight + 3;
    };

    drawHeader();

    addSectionTitle('Resumen ejecutivo');
    addKeyValue('Fondo inicial', this.fmt(this.fondoInicial));
    addKeyValue('Total efectivo', this.fmt(this.totalEfectivo));
    addKeyValue('Total tarjeta bruto', this.fmt(this.totalTarjetaBruto));
    addKeyValue('Total tarjeta neto', this.fmt(this.totalTarjetaNeto));

    addSectionTitle('Pedidos');

    if (!this.ordersData.length) {
      addTextBlock('Sin pedidos registrados en la jornada activa.', {
        color: palette.muted,
        fontSize: 9.5,
      });
    }

    for (const order of this.ordersData) {
      addOrderBlock(order);
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      doc.setDrawColor(...palette.border);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...palette.muted);
      doc.text(`Generado ${generatedAt}`, margin, pageHeight - 7);
      doc.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    doc.save(`reporte-ventas-${this.dateRange.toLowerCase()}.pdf`);
  }

  protected toggleOrder(id: string): void {
    if (this.expandedOrders.has(id)) {
      this.expandedOrders.delete(id);
      return;
    }
    this.expandedOrders.add(id);
  }

  protected isExpanded(id: string): boolean {
    return this.expandedOrders.has(id);
  }

  protected fmt(n: number): string {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  private async loadResumenVentas(): Promise<void> {
    this.infoMessage = '';
    this.totalVentas = 0;
    this.totalEfectivo = 0;
    this.totalTarjetaBruto = 0;
    this.totalTarjetaNeto = 0;
    this.ordersData = [];
    this.expandedOrders.clear();

    try {
      const parametros = await this.apiClient.get<ParametrosLocalApi>('/api/operacion/parametros');
      this.fondoInicial = Number(parametros.fondoLunes ?? this.fondoInicial);
    } catch {
      // Mantiene fallback visual en caso de no haber parametros.
    }

    await this.jornadaService.refreshJornada();
    const jornada = this.jornadaService.jornadaAbierta();

    if (!jornada) {
      this.infoMessage = 'No hay jornada activa para consultar reporte de ventas.';
      return;
    }

    try {
      const ventas = await this.apiClient.get<VentaApi[]>('/api/ventas/activas');
      const ventasJornada = ventas.filter((venta) => venta.jornada?.id === jornada.id);

      const orders = await Promise.all(
        ventasJornada.map(async (venta) => {
          const [items, pagos] = await Promise.all([
            this.apiClient.get<ItemVentaApi[]>(`/api/ventas/items/venta/${venta.id}`),
            this.apiClient.get<PagoApi[]>(`/api/ventas/pagos/venta/${venta.id}`),
          ]);
          return this.mapOrder(venta, items, pagos);
        }),
      );

      this.ordersData = orders;

      const resumen = await this.apiClient.get<ResumenVentasApi[]>(
        `/api/reportes/ventas-diarias/jornada/${jornada.id}`,
      );

      if (!resumen.length) {
        this.totalVentas = 0;
        this.totalEfectivo = 0;
        this.totalTarjetaBruto = 0;
        this.totalTarjetaNeto = 0;
        this.infoMessage = 'No hay datos de ventas para la jornada activa.';
        return;
      }

      this.totalVentas = resumen.reduce(
        (accumulator, item) => accumulator + Number(item.totalVentas ?? 0),
        0,
      );
      this.totalEfectivo = resumen.reduce(
        (accumulator, item) => accumulator + Number(item.totalEfectivo ?? 0),
        0,
      );
      this.totalTarjetaBruto = resumen.reduce(
        (accumulator, item) => accumulator + Number(item.totalTarjetaBruto ?? 0),
        0,
      );
      this.totalTarjetaNeto = resumen.reduce(
        (accumulator, item) => accumulator + Number(item.totalTarjetaNeto ?? 0),
        0,
      );
    } catch (error) {
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar el resumen de ventas.';
    }
  }

  private mapOrder(venta: VentaApi, items: ItemVentaApi[], pagos: PagoApi[]): OrderRow {
    const dishes = items.map((item) => {
      const cantidad = Number(item.cantidad ?? 1);
      const precioTotal = Number(item.precioUnitario ?? 0) * (Number.isFinite(cantidad) ? cantidad : 1);
      const nombreBase = item.producto?.nombre || 'Platillo';
      return {
        nombre: cantidad > 1 ? `${nombreBase} x${cantidad}` : nombreBase,
        precio: precioTotal,
      };
    });

    const pagosTarjeta = pagos.filter((pago) =>
      (pago.metodoPago?.nombre || '').toLowerCase().includes('tarjeta'),
    );
    const pagosEfectivo = pagos.filter((pago) =>
      (pago.metodoPago?.nombre || '').toLowerCase().includes('efectivo'),
    );

    const tarjetaBruto = pagosTarjeta.reduce((acc, pago) => acc + Number(pago.monto ?? 0), 0);
    const tarjetaNeto = pagosTarjeta.reduce((acc, pago) => acc + Number(pago.montoNeto ?? 0), 0);
    const efectivoAmount = pagosEfectivo.reduce((acc, pago) => acc + Number(pago.monto ?? 0), 0);

    const totalBruto = tarjetaBruto + efectivoAmount;
    const brutoFallback = totalBruto > 0 ? totalBruto : Number(venta.totalCuenta ?? 0);
    const netoFallback = tarjetaNeto + efectivoAmount;
    const totalNeto = netoFallback > 0 ? netoFallback : brutoFallback;

    let tipoPago: OrderRow['tipoPago'] = 'efectivo';
    if (tarjetaBruto > 0 && efectivoAmount > 0) {
      tipoPago = 'mixto';
    } else if (tarjetaBruto > 0) {
      tipoPago = 'tarjeta';
    }

    return {
      id: `order-${venta.id}`,
      mesa: `Mesa ${venta.mesa?.numero ?? '-'}`,
      pedido: venta.id,
      totalBruto: brutoFallback,
      totalNeto,
      tipoPago,
      efectivoAmount: tipoPago !== 'tarjeta' ? efectivoAmount || brutoFallback : undefined,
      tarjetaBruto: tipoPago !== 'efectivo' ? tarjetaBruto || brutoFallback : undefined,
      tarjetaNeto: tipoPago !== 'efectivo' ? tarjetaNeto || totalNeto : undefined,
      dishes,
    };
  }
}
