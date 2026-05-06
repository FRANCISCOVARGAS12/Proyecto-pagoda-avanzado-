import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

type RangePreset = 'weekly' | 'monthly' | 'custom';
type JornadaSelection = number | 'all';
const LAST_JORNADA_STORAGE_KEY = 'pagoda-ventas-last-jornada';

interface DishItem {
  nombre: string;
  precio: number;
}

interface OrderRow {
  id: string;
  mesa: string;
  pedido: number;
  jornadaFecha: string;
  totalBruto: number;
  totalNeto: number;
  tipoPago: 'efectivo' | 'tarjeta' | 'mixto';
  efectivoAmount?: number;
  tarjetaBruto?: number;
  tarjetaNeto?: number;
  dishes: DishItem[];
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

interface JornadaApi {
  id: number;
  fecha: string;
  estado: 'ABIERTA' | 'CERRADA' | string;
  horaApertura: string;
  horaCierre: string | null;
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
export class Ventas implements OnInit, OnDestroy {
  protected rangePreset: RangePreset = 'weekly';
  protected startDate = '';
  protected endDate = '';
  protected minFechaConsulta = '';
  protected maxFechaConsulta = '';
  protected jornadas: JornadaApi[] = [];
  protected jornadasFiltradas: JornadaApi[] = [];
  protected selectedJornadaId: JornadaSelection | null = null;

  protected totalVentas = 0;
  protected fondoInicial = 2000;
  protected totalEfectivo = 0;
  protected totalTarjetaBruto = 0;
  protected totalTarjetaNeto = 0;
  protected infoMessage = '';
  protected ordersData: OrderRow[] = [];
  protected cargandoResumen = false;
  protected filtrosPendientes = false;

  private readonly expandedOrders = new Set<string>();
  private jornadaAbiertaId: number | null = null;
  private appliedStartDate = '';
  private appliedEndDate = '';
  private appliedJornadaId: JornadaSelection | null = null;
  private wsUnsubscribers: Array<() => void> = [];
  protected jornadaAbierta = false;

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly wsService: WebSocketService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadJornadas();

    // Inicializar el estado según la respuesta del API
    this.jornadaAbierta = this.jornadaAbiertaId !== null;
    this.syncAppliedFiltersWithDraft();

    this.changeDetector.detectChanges();
    await this.loadResumenVentas();

    // Activar actualizaciones en tiempo real
    this.subscribeToWebSocket();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.wsUnsubscribers = [];
  }

  // NUEVO: suscripciones a eventos de jornada y pedido
  private subscribeToWebSocket(): void {
    // Escuchar cambios de jornada (abrir/cerrar)
    const unsubJornada = this.wsService.subscribe('/topic/jornada', (event: any) => {
      if (event.accion === 'ABIERTA' && event.jornada) {
        const nueva: JornadaApi = event.jornada;
        // Evitar duplicados
        if (!this.jornadas.some(j => j.id === nueva.id)) {
          this.jornadas = [nueva, ...this.jornadas];
        } else {
          // Actualizar estado a ABIERTA
          this.jornadas = this.jornadas.map(j => j.id === nueva.id ? nueva : j);
        }
        this.updateDateBoundsFromJornadas();
        this.applyJornadaFilter();
        this.jornadaAbiertaId = nueva.id;
        this.jornadaAbierta = true;
        this.updatePendingState();

        if (this.appliedJornadaId === nueva.id) {
          void this.loadResumenVentas();
        }
      } else if (event.accion === 'CERRADA' && event.jornada) {
        const cerrada: JornadaApi = event.jornada;
        this.jornadas = this.jornadas.map(j =>
          j.id === cerrada.id ? { ...j, estado: 'CERRADA' } : j
        );
        this.updateDateBoundsFromJornadas();
        this.applyJornadaFilter();
        if (this.jornadaAbiertaId === cerrada.id) {
          this.jornadaAbiertaId = null;
          this.jornadaAbierta = false;
        }
        this.updatePendingState();

        // Si era el alcance aplicado, recargar para reflejar el cambio
        if (this.appliedJornadaId === cerrada.id) {
          void this.loadResumenVentas();
        }
      }
    });
    this.wsUnsubscribers.push(unsubJornada);

    // Escuchar nuevos pedidos/cierre de pedidos
    const unsubPedido = this.wsService.subscribe('/topic/pedido', (event: any) => {
      // event: { accion: 'CREADO'|'CERRADO', pedido: { id, jornada: { id }, ... } }
      if (!event.pedido || !event.pedido.jornada?.id) return;
      const jornadaIdPedido = event.pedido.jornada.id;

      if (!this.isPedidoInAppliedScope(jornadaIdPedido)) return;

      // Recargar los pedidos (seguro y simple)
      void this.loadResumenVentas();
    });
    this.wsUnsubscribers.push(unsubPedido);
  }

  protected onPresetChange(): void {
    if (this.rangePreset !== 'custom') {
      this.applyPresetDates(this.rangePreset);
    }
    this.applyJornadaFilter();
    this.updatePendingState();
  }

  protected onDateRangeChange(): void {
    this.rangePreset = 'custom';
    this.applyJornadaFilter();
    this.updatePendingState();
  }

  protected onJornadaChange(): void {
    this.updatePendingState();
  }

  protected async applyFilters(): Promise<void> {
    this.infoMessage = '';
    if (this.isDateRangeInvalid()) {
      return;
    }
    if (this.isDateOutOfAvailableRange()) {
      this.infoMessage = `Solo puedes consultar entre ${this.availableRangeLabel()}.`;
      return;
    }

    const { start, end } = this.normalizedRangeFrom(this.startDate, this.endDate);
    this.appliedStartDate = start;
    this.appliedEndDate = end;
    this.appliedJornadaId = this.selectedJornadaId;
    this.saveLastJornadaSelection(this.selectedJornadaId);
    await this.loadResumenVentas();
    this.updatePendingState();
  }

  protected async clearFilters(): Promise<void> {
    const fechaReferencia = this.resolveDefaultReferenceDate();
    this.rangePreset = 'custom';
    this.startDate = fechaReferencia;
    this.endDate = fechaReferencia;
    this.applyJornadaFilter();
    this.selectedJornadaId = this.resolveDefaultJornadaSelection();
    await this.applyFilters();
  }

  protected isDateRangeInvalid(): boolean {
    return Boolean(this.startDate && this.endDate && this.endDate < this.startDate);
  }

  protected isDateOutOfAvailableRange(): boolean {
    if (!this.minFechaConsulta || !this.maxFechaConsulta) {
      return false;
    }
    const { start, end } = this.normalizedRangeFrom(this.startDate, this.endDate);
    if (!start || !end) {
      return false;
    }
    return start < this.minFechaConsulta || end > this.maxFechaConsulta;
  }

  protected availableRangeLabel(): string {
    if (!this.minFechaConsulta || !this.maxFechaConsulta) {
      return 'rango disponible';
    }
    if (this.minFechaConsulta === this.maxFechaConsulta) {
      return this.formatDate(this.minFechaConsulta);
    }
    return `${this.formatDate(this.minFechaConsulta)} a ${this.formatDate(this.maxFechaConsulta)}`;
  }

  protected isApplyDisabled(): boolean {
    return this.cargandoResumen || this.isDateRangeInvalid() || this.isDateOutOfAvailableRange();
  }

  protected jornadaLabel(jornada: JornadaApi): string {
    return `#${jornada.id} · ${this.formatDate(jornada.fecha)} · ${jornada.estado}`;
  }

  protected selectedScopeLabel(): string {
    const jornadasAplicadas = this.getJornadasByRange(this.appliedStartDate, this.appliedEndDate);
    if (!jornadasAplicadas.length) {
      return 'Sin jornadas en el rango';
    }
    if (this.appliedJornadaId === 'all' || this.appliedJornadaId === null) {
      return `${jornadasAplicadas.length} jornada(s) del rango`;
    }
    // Buscar en todas las jornadas (no solo filtradas)
    const jornada = this.jornadas.find((item) => item.id === this.appliedJornadaId);
    return jornada ? this.jornadaLabel(jornada) : 'Jornada no disponible';
  }

  protected rangeLabel(): string {
    const { start, end } = this.normalizedRangeFrom(this.appliedStartDate, this.appliedEndDate);
    if (!start || !end) {
      return 'Sin rango definido';
    }
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };
    if (start === end) {
      return fmt(start);
    }
    return `${fmt(start)} a ${fmt(end)}`;
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

    const drawHeader = (): void => {
      doc.setFillColor(...palette.primarySoft);
      doc.rect(0, 0, pageWidth, 38, 'F');

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
      doc.text(`Rango: ${this.rangeLabel()}`, margin, 27);
      doc.text(`Ambito: ${this.selectedScopeLabel()}`, margin, 33);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...palette.primary);
      doc.text(this.fmt(this.totalVentas), pageWidth - margin, 18, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...palette.muted);
      doc.text('Total de ventas', pageWidth - margin, 24, { align: 'right' });

      y = 44;
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
      const estimatedHeight = 28 + order.dishes.length * 5 + extraLines * 4;
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

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.muted);
      doc.text(`Fecha jornada: ${order.jornadaFecha}`, margin + 4.5, y + 12.2);

      const paymentLabel =
        order.tipoPago === 'efectivo' ? 'Efectivo' : order.tipoPago === 'tarjeta' ? 'Tarjeta' : 'Mixto';

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...palette.primary);
      doc.text(this.fmt(order.totalNeto), pageWidth - margin - 4.5, y + 7.2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.muted);
      doc.text(paymentLabel, pageWidth - margin - 4.5, y + 12.2, { align: 'right' });

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
      ensureSpace(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...palette.muted);
      doc.text('Sin pedidos registrados en el ambito seleccionado.', margin, y);
      y += 7;
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
      doc.text(`Pagina ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    const scopeSlug = this.selectedJornadaId === 'all' ? 'rango' : `jornada-${this.selectedJornadaId ?? 'na'}`;
    const rangeSlug = this.rangeLabel()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    doc.save(`reporte-ventas-${scopeSlug}-${rangeSlug || 'filtro'}.pdf`);
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
    this.cargandoResumen = true;
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
    this.totalVentas = this.fondoInicial;

    const jornadasSeleccionadas = this.getSelectedJornadasForAppliedFilters();
    if (!jornadasSeleccionadas.length) {
      this.infoMessage = 'No hay jornadas en el rango seleccionado.';
      this.cargandoResumen = false;
      return;
    }

    try {
      const ventasAgrupadas = await Promise.all(
        jornadasSeleccionadas.map((jornada) => this.apiClient.get<VentaApi[]>(`/api/ventas/jornada/${jornada.id}`)),
      );
      const ventas = ventasAgrupadas.flat();

      if (!ventas.length) {
        this.infoMessage = 'No hay ventas registradas en el rango seleccionado.';
        return;
      }

      const jornadaFechaById = new Map(jornadasSeleccionadas.map((jornada) => [jornada.id, jornada.fecha]));
      const orders = await Promise.all(
        ventas.map(async (venta) => {
          const [items, pagos] = await Promise.all([
            this.apiClient.get<ItemVentaApi[]>(`/api/ventas/items/venta/${venta.id}`),
            this.apiClient.get<PagoApi[]>(`/api/ventas/pagos/venta/${venta.id}`),
          ]);
          const jornadaFechaRaw = jornadaFechaById.get(venta.jornada?.id ?? -1) ?? 'Sin fecha';
          const jornadaFecha = jornadaFechaRaw === 'Sin fecha' ? jornadaFechaRaw : this.formatDate(jornadaFechaRaw);
          return this.mapOrder(venta, items, pagos, jornadaFecha);
        }),
      );

      this.ordersData = orders;
      this.totalEfectivo = orders.reduce(
        (accumulator, order) => accumulator + Number(order.efectivoAmount ?? 0),
        0,
      );
      this.totalTarjetaBruto = orders.reduce(
        (accumulator, order) => accumulator + Number(order.tarjetaBruto ?? 0),
        0,
      );
      this.totalTarjetaNeto = orders.reduce(
        (accumulator, order) => accumulator + Number(order.tarjetaNeto ?? 0),
        0,
      );
      this.totalVentas = this.fondoInicial + this.totalEfectivo + this.totalTarjetaNeto;
    } catch (error) {
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar el resumen de ventas.';
    } finally {
      this.cargandoResumen = false;
    }
  }

  private async loadJornadas(): Promise<void> {
    try {
      const [jornadas, jornadaAbierta] = await Promise.all([
        this.apiClient.get<JornadaApi[]>('/api/operacion/jornadas'),
        this.apiClient.getOrNull<JornadaApi>('/api/operacion/jornadas/estado'),
      ]);
      const ultimaSeleccion = this.readLastJornadaSelection();
      this.jornadaAbiertaId = jornadaAbierta?.id ?? null;
      this.jornadas = [...jornadas].sort((a, b) => {
        const fechaA = this.isoDateKey(a.fecha);
        const fechaB = this.isoDateKey(b.fecha);
        if (fechaA === fechaB) {
          return b.id - a.id;
        }
        return fechaB.localeCompare(fechaA);
      });
      this.updateDateBoundsFromJornadas();

      // Prioridad: 1. Abierta, 2. Última registrada, 3. Hoy
      const referenceDate =
        jornadaAbierta?.fecha ?? (this.jornadas.length ? this.jornadas[0].fecha : this.toIsoDate(new Date()));

      const isoRef = this.isoDateKey(referenceDate);
      this.startDate = isoRef;
      this.endDate = isoRef;
      this.rangePreset = 'custom';

      this.applyJornadaFilter();

      if (this.jornadaAbiertaId) {
        this.selectedJornadaId = this.jornadaAbiertaId;
      } else if (
        ultimaSeleccion === 'all' ||
        (typeof ultimaSeleccion === 'number' && this.jornadas.some((jornada) => jornada.id === ultimaSeleccion))
      ) {
        this.selectedJornadaId = ultimaSeleccion;
      } else if (this.jornadas.length > 0) {
        this.selectedJornadaId = this.jornadas[0].id;
      } else {
        this.selectedJornadaId = null;
      }
      this.saveLastJornadaSelection(this.selectedJornadaId);
      this.updatePendingState();
    } catch (error) {
      this.jornadaAbiertaId = null;
      this.jornadas = [];
      this.jornadasFiltradas = [];
      this.selectedJornadaId = null;
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudieron cargar las jornadas.';
      this.updatePendingState();
    }
  }

  private mapOrder(
    venta: VentaApi,
    items: ItemVentaApi[],
    pagos: PagoApi[],
    jornadaFecha: string,
  ): OrderRow {
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
      jornadaFecha,
      totalBruto: brutoFallback,
      totalNeto,
      tipoPago,
      efectivoAmount: tipoPago !== 'tarjeta' ? efectivoAmount || brutoFallback : undefined,
      tarjetaBruto: tipoPago !== 'efectivo' ? tarjetaBruto || brutoFallback : undefined,
      tarjetaNeto: tipoPago !== 'efectivo' ? tarjetaNeto || totalNeto : undefined,
      dishes,
    };
  }

  private applyPresetDates(preset: RangePreset, referenceDate?: string): void {
    const reference = referenceDate ? this.parseIsoDate(referenceDate) : new Date();
    const end = this.toIsoDate(reference);
    const startDate = new Date(reference);

    if (preset === 'weekly') {
      startDate.setDate(reference.getDate() - 6);
    } else if (preset === 'monthly') {
      startDate.setDate(reference.getDate() - 29);
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
      const jornadaDate = this.isoDateKey(jornada.fecha);
      return jornadaDate >= start && jornadaDate <= end;
    });

    if (!this.jornadasFiltradas.length) {
      if (
        this.selectedJornadaId !== null &&
        this.selectedJornadaId !== 'all' &&
        this.jornadas.some((jornada) => jornada.id === this.selectedJornadaId)
      ) {
        return;
      }
      this.selectedJornadaId = null;
      return;
    }

    if (this.selectedJornadaId === null) {
      this.selectedJornadaId = this.resolveDefaultJornadaSelection();
      return;
    }

    if (
      this.selectedJornadaId !== 'all' &&
      !this.jornadas.some((jornada) => jornada.id === this.selectedJornadaId)
    ) {
      this.selectedJornadaId = this.resolveDefaultJornadaSelection();
    }
  }

  private resolveDefaultJornadaSelection(): JornadaSelection {
    if (
      this.jornadaAbiertaId !== null &&
      this.jornadasFiltradas.some((jornada) => jornada.id === this.jornadaAbiertaId)
    ) {
      return this.jornadaAbiertaId;
    }
    return 'all';
  }

  private getSelectedJornadasForAppliedFilters(): JornadaApi[] {
    const jornadasEnRango = this.getJornadasByRange(this.appliedStartDate, this.appliedEndDate);
    if (this.appliedJornadaId === 'all' || this.appliedJornadaId === null) {
      return jornadasEnRango;
    }
    const jornada = this.jornadas.find((item) => item.id === this.appliedJornadaId);
    return jornada ? [jornada] : [];
  }

  private normalizedRange(): { start: string; end: string } {
    return this.normalizedRangeFrom(this.startDate, this.endDate);
  }

  private normalizedRangeFrom(startDate: string, endDate: string): { start: string; end: string } {
    let start = startDate;
    let end = endDate;
    if (start && end && start > end) {
      [start, end] = [end, start];
    }
    return { start, end };
  }

  private getJornadasByRange(startDate: string, endDate: string): JornadaApi[] {
    const { start, end } = this.normalizedRangeFrom(startDate, endDate);
    return this.jornadas.filter((jornada) => {
      if (!start || !end) {
        return true;
      }
      const jornadaDate = this.isoDateKey(jornada.fecha);
      return jornadaDate >= start && jornadaDate <= end;
    });
  }

  private updateDateBoundsFromJornadas(): void {
    if (!this.jornadas.length) {
      this.minFechaConsulta = '';
      this.maxFechaConsulta = '';
      return;
    }

    const fechas = this.jornadas
      .map((jornada) => this.isoDateKey(jornada.fecha))
      .filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha));

    if (!fechas.length) {
      this.minFechaConsulta = '';
      this.maxFechaConsulta = '';
      return;
    }

    this.minFechaConsulta = fechas.reduce((min, fecha) => (fecha < min ? fecha : min), fechas[0]);
    this.maxFechaConsulta = fechas.reduce((max, fecha) => (fecha > max ? fecha : max), fechas[0]);

    if (this.startDate && this.startDate < this.minFechaConsulta) {
      this.startDate = this.minFechaConsulta;
    } else if (this.startDate && this.startDate > this.maxFechaConsulta) {
      this.startDate = this.maxFechaConsulta;
    }

    if (this.endDate && this.endDate < this.minFechaConsulta) {
      this.endDate = this.minFechaConsulta;
    } else if (this.endDate && this.endDate > this.maxFechaConsulta) {
      this.endDate = this.maxFechaConsulta;
    }
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Devuelve la fecha en formato ISO (yyyy-mm-dd) para comparaciones internas
  private isoDateKey(rawDate: string): string {
    return (rawDate ?? '').toString().slice(0, 10);
  }

  // Formatea una fecha ISO a dd/mm/yyyy para mostrar al usuario
  private formatDate(rawDate: string): string {
    const iso = this.isoDateKey(rawDate);
    if (!iso || iso.length < 10) return iso;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private parseIsoDate(rawDate: string): Date {
    const normalized = this.isoDateKey(rawDate);
    const parsed = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  }

  private readLastJornadaSelection(): JornadaSelection | null {
    try {
      const value = localStorage.getItem(LAST_JORNADA_STORAGE_KEY);
      if (value === 'all') {
        return 'all';
      }

      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private saveLastJornadaSelection(selection: JornadaSelection | null): void {
    try {
      if (selection === null) {
        localStorage.removeItem(LAST_JORNADA_STORAGE_KEY);
        return;
      }
      localStorage.setItem(LAST_JORNADA_STORAGE_KEY, selection === 'all' ? 'all' : `${selection}`);
    } catch {
      // Ignora errores de storage para no bloquear la vista.
    }
  }

  private syncAppliedFiltersWithDraft(): void {
    const { start, end } = this.normalizedRangeFrom(this.startDate, this.endDate);
    this.appliedStartDate = start;
    this.appliedEndDate = end;
    this.appliedJornadaId = this.selectedJornadaId;
    this.updatePendingState();
  }

  private updatePendingState(): void {
    const { start, end } = this.normalizedRangeFrom(this.startDate, this.endDate);
    this.filtrosPendientes =
      start !== this.appliedStartDate ||
      end !== this.appliedEndDate ||
      this.selectedJornadaId !== this.appliedJornadaId;
  }

  private resolveDefaultReferenceDate(): string {
    if (this.jornadaAbiertaId !== null) {
      const jornadaAbierta = this.jornadas.find((jornada) => jornada.id === this.jornadaAbiertaId);
      if (jornadaAbierta?.fecha) {
        return this.isoDateKey(jornadaAbierta.fecha);
      }
    }
    if (this.jornadas.length) {
      return this.isoDateKey(this.jornadas[0].fecha);
    }
    return this.toIsoDate(new Date());
  }

  private isPedidoInAppliedScope(jornadaId: number): boolean {
    if (this.appliedJornadaId !== null && this.appliedJornadaId !== 'all') {
      return this.appliedJornadaId === jornadaId;
    }

    const jornada = this.jornadas.find((item) => item.id === jornadaId);
    if (!jornada) {
      return false;
    }

    const { start, end } = this.normalizedRangeFrom(this.appliedStartDate, this.appliedEndDate);
    if (!start || !end) {
      return true;
    }

    const fechaJornada = this.isoDateKey(jornada.fecha);
    return fechaJornada >= start && fechaJornada <= end;
  }
}
