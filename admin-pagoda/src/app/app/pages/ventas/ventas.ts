import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { WebSocketService } from '../../core/websocket/websocket.service';

type RangePreset = 'weekly' | 'monthly' | 'custom';
type JornadaSelection = number | 'all';
type PaymentMethodKey = 'efectivo' | 'tarjeta';
type TipDiscountPolicy = 'same-or-null' | 'always';
const LAST_JORNADA_STORAGE_KEY = 'pagoda-ventas-last-jornada';
const SALES_FILTERS_STORAGE_KEY = 'pagoda-ventas-filtros-v1';

interface VentasFiltersCache {
  rangePreset: RangePreset;
  startDate: string;
  endDate: string;
  selectedJornadaId: JornadaSelection | null;
  useDateRangeDraft: boolean;
  appliedStartDate: string;
  appliedEndDate: string;
  appliedJornadaId: JornadaSelection | null;
  appliedUseDateRange: boolean;
  followActiveJornada: boolean;
  hasManualConsulta: boolean;
}

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
  tarjetaComisionPorcentaje?: number;
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
  comisionBancaria: number;
}

interface VentaApi {
  id: number;
  mesa: { numero: number } | null;
  jornada: { id: number } | null;
  totalCuenta: number;
  fechaCierre: string | null;
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
  propinaMetodoPago?: { nombre: string } | null;
  monto: number;
  comisionPorcentaje?: number;
  montoNeto: number;
  propinaMonto?: number;
  propinaNeto?: number;
}

interface JornadaDayInfo {
  index: number;
  total: number;
}

@Component({
  selector: 'app-ventas',
  imports: [FormsModule],
  templateUrl: './ventas.html',
  styleUrl: './ventas.css',
})
export class Ventas implements OnInit, OnDestroy {
  protected rangePreset: RangePreset = 'custom';
  protected startDate = '';
  protected endDate = '';
  protected minFechaConsulta = '';
  protected maxFechaConsulta = '';
  protected jornadas: JornadaApi[] = [];
  protected jornadasFiltradas: JornadaApi[] = [];
  protected selectedJornadaId: JornadaSelection | null = null;
  protected historialJornadasVisible = false;
  protected historialJornadaSearchTerm = '';

  protected totalVentas = 0;
  protected fondoInicial = 2000;
  protected comisionTarjeta = 3.5;
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
  private realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private resumenRequestSeq = 0;
  private followActiveJornada = false;
  private useDateRangeDraft = false;
  private appliedUseDateRange = false;
  private hasManualConsulta = false;
  private readonly jornadaDayInfoById = new Map<number, JornadaDayInfo>();
  private parametrosLocal: ParametrosLocalApi | null = null;
  protected jornadaAbierta = false;

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly wsService: WebSocketService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadJornadas();
    await this.applyConfiguredDefaults();
    this.restorePersistedFiltersState();

    // Inicializar el estado según la respuesta del API
    this.jornadaAbierta = this.jornadaAbiertaId !== null;
    if (!this.hasManualConsulta) {
      this.syncAppliedFiltersWithDraft();
    } else {
      this.updatePendingState();
    }
    if (this.hasManualConsulta && this.hasValidAppliedScopeSelection()) {
      await this.loadResumenVentas();
    } else {
      this.updateEmptySummary(this.fondoInicial);
    }

    this.changeDetector.detectChanges();

    // Activar actualizaciones en tiempo real
    this.subscribeToWebSocket();
  }

  ngOnDestroy(): void {
    this.wsUnsubscribers.forEach((unsubscribe) => unsubscribe());
    this.wsUnsubscribers = [];
    if (this.realtimeRefreshTimer) {
      clearTimeout(this.realtimeRefreshTimer);
      this.realtimeRefreshTimer = null;
    }
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
        this.rebuildJornadaDayInfo();
        this.updateDateBoundsFromJornadas();
        this.applyJornadaFilter();
        this.jornadaAbiertaId = nueva.id;
        this.jornadaAbierta = true;
        const shouldAutoFollowOpened = !this.filtrosPendientes && (this.followActiveJornada || this.hasManualConsulta);
        if (shouldAutoFollowOpened) {
          void this.autoApplyOpenedJornada(nueva);
          return;
        }
        this.updatePendingState();
      } else if (event.accion === 'CERRADA' && event.jornada) {
        const cerrada: JornadaApi = event.jornada;
        const wasFollowingClosedJornada =
          this.followActiveJornada &&
          this.appliedJornadaId !== null &&
          this.appliedJornadaId !== 'all' &&
          this.appliedJornadaId === cerrada.id;
        this.jornadas = this.jornadas.map(j =>
          j.id === cerrada.id ? { ...j, estado: 'CERRADA' } : j
        );
        this.rebuildJornadaDayInfo();
        this.updateDateBoundsFromJornadas();
        this.applyJornadaFilter();
        if (this.jornadaAbiertaId === cerrada.id) {
          this.jornadaAbiertaId = null;
          this.jornadaAbierta = false;
          this.followActiveJornada = false;
        } else if (wasFollowingClosedJornada) {
          this.followActiveJornada = false;
        }
        this.updatePendingState();
      }
    });
    this.wsUnsubscribers.push(unsubJornada);

    // Escuchar nuevos pedidos/cierre de pedidos
    const unsubPedido = this.wsService.subscribe('/topic/pedido', (event: any) => {
      if (event?.accion !== 'CERRADO') {
        return;
      }

      const jornadaIdPedido = this.extractPedidoJornadaId(event);
      if (!jornadaIdPedido) {
        return;
      }

      if (!this.isPedidoInAppliedScope(jornadaIdPedido)) {
        return;
      }
      if (!this.shouldRealtimeRefreshForPedido(jornadaIdPedido)) {
        return;
      }

      this.scheduleRealtimeRefresh();
    });
    this.wsUnsubscribers.push(unsubPedido);
  }

  protected onPresetChange(): void {
    this.closeJornadasHistorial();
    if (this.rangePreset !== 'custom') {
      const anchor = this.endDate || this.startDate || this.resolveDefaultReferenceDate();
      this.applyPresetDates(this.rangePreset, anchor);
      this.useDateRangeDraft = true;
      this.selectedJornadaId = 'all';
      this.followActiveJornada = false;
    } else {
      this.useDateRangeDraft = Boolean(this.startDate && this.endDate);
      if (this.useDateRangeDraft) {
        this.selectedJornadaId = 'all';
      }
    }
    this.applyJornadaFilter();
    this.updatePendingState();
  }

  protected onDateRangeChange(source: 'start' | 'end' = 'end'): void {
    this.closeJornadasHistorial();
    if (this.rangePreset === 'weekly') {
      const anchor = source === 'start' ? this.startDate : this.endDate;
      this.applyWeeklyWindowFrom(anchor || this.resolveDefaultReferenceDate(), source);
    } else if (this.rangePreset === 'monthly') {
      const anchor = source === 'start' ? this.startDate : this.endDate;
      this.applyMonthlyWindowFrom(anchor || this.resolveDefaultReferenceDate());
    }
    this.useDateRangeDraft = Boolean(this.startDate && this.endDate);
    if (this.useDateRangeDraft) {
      this.selectedJornadaId = 'all';
      this.followActiveJornada = false;
    }
    this.applyJornadaFilter();
    this.updatePendingState();
  }

  protected onJornadaChange(): void {
    if (this.selectedJornadaId === null) {
      this.followActiveJornada = false;
      this.updatePendingState();
      return;
    }

    if (this.selectedJornadaId !== 'all') {
      this.rangePreset = 'custom';
      this.startDate = '';
      this.endDate = '';
      this.useDateRangeDraft = false;
      this.followActiveJornada = false;
      this.applyJornadaFilter();
    }
    this.updatePendingState();
  }

  protected isRangeModeForJornadaSelect(): boolean {
    return this.useDateRangeDraft;
  }

  protected jornadaPickerLabel(): string {
    if (this.useDateRangeDraft) {
      return 'Todas las jornadas en el rango seleccionado';
    }

    if (!this.jornadasFiltradas.length) {
      return 'Sin jornadas disponibles';
    }

    if (this.selectedJornadaId === null) {
      return 'Seleccionar jornada';
    }

    if (this.selectedJornadaId === 'all') {
      return 'Todas las jornadas';
    }

    const jornada = this.jornadas.find((item) => item.id === this.selectedJornadaId);
    return jornada ? this.jornadaLabel(jornada) : 'Seleccionar jornada';
  }

  protected canOpenJornadaPicker(): boolean {
    return !this.useDateRangeDraft && this.jornadasFiltradas.length > 0;
  }

  protected openJornadasHistorial(): void {
    if (!this.canOpenJornadaPicker()) {
      return;
    }
    this.historialJornadaSearchTerm = '';
    this.historialJornadasVisible = true;
  }

  protected closeJornadasHistorial(): void {
    this.historialJornadasVisible = false;
    this.historialJornadaSearchTerm = '';
  }

  protected jornadasHistorialOpciones(): JornadaApi[] {
    const candidatas = [...this.jornadasFiltradas];
    const term = this.historialJornadaSearchTerm.trim().toLowerCase();
    if (!term) {
      return candidatas;
    }

    return candidatas.filter((jornada) => {
      const label = this.jornadaLabel(jornada).toLowerCase();
      const fecha = this.formatDate(this.jornadaDateKey(jornada)).toLowerCase();
      return label.includes(term) || fecha.includes(term) || `${jornada.id}`.includes(term);
    });
  }

  protected selectJornadaFromHistorial(selection: JornadaSelection): void {
    this.selectedJornadaId = selection;
    this.onJornadaChange();
    this.closeJornadasHistorial();
  }

  protected async applyFilters(): Promise<void> {
    this.infoMessage = '';
    this.syncDraftSelectionBeforeApply();
    if (!this.hasValidDraftScopeSelection()) {
      this.infoMessage = 'Selecciona una jornada o un rango de fechas antes de consultar.';
      return;
    }
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
    this.appliedUseDateRange = this.useDateRangeDraft;
    this.appliedJornadaId = this.appliedUseDateRange ? 'all' : this.selectedJornadaId;
    this.followActiveJornada = this.shouldFollowActiveJornadaAfterApply();
    this.hasManualConsulta = true;
    if (!this.appliedUseDateRange) {
      this.saveLastJornadaSelection(this.selectedJornadaId);
    }
    await this.loadResumenVentas();
    this.persistFiltersState();
    this.updatePendingState();
  }

  protected async clearFilters(): Promise<void> {
    this.rangePreset = 'custom';
    this.startDate = '';
    this.endDate = '';
    this.useDateRangeDraft = false;
    this.closeJornadasHistorial();
    this.applyJornadaFilter();
    this.selectedJornadaId = null;
    this.followActiveJornada = false;
    this.hasManualConsulta = false;
    this.appliedStartDate = '';
    this.appliedEndDate = '';
    this.appliedJornadaId = null;
    this.appliedUseDateRange = false;
    this.infoMessage = '';
    this.ordersData = [];
    this.expandedOrders.clear();
    await this.applyConfiguredDefaults();
    this.updateEmptySummary(this.fondoInicial);
    this.clearPersistedFiltersState();
    this.saveLastJornadaSelection(null);
    this.updatePendingState();
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
    return (
      this.cargandoResumen ||
      this.isDateRangeInvalid() ||
      this.isDateOutOfAvailableRange() ||
      !this.hasValidDraftScopeSelection()
    );
  }

  protected jornadaLabel(jornada: JornadaApi): string {
    const etiqueta = this.jornadaTurnLabel(jornada);
    const fecha = this.jornadaDateKey(jornada);
    const withEtiqueta = etiqueta ? `${this.formatDate(fecha)} · ${etiqueta}` : this.formatDate(fecha);
    return `#${jornada.id} · ${withEtiqueta} · ${jornada.estado}`;
  }

  protected selectedScopeLabel(): string {
    if (this.appliedJornadaId === null && !this.appliedUseDateRange) {
      return 'Sin jornada seleccionada';
    }
    const jornadasAplicadas = this.getJornadasByRange(this.appliedStartDate, this.appliedEndDate);
    if (!jornadasAplicadas.length) {
      return 'Sin jornadas en el rango';
    }
    if (this.appliedJornadaId === 'all') {
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
    const normalized = this.roundCurrency(n);
    return `$${normalized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  protected comisionLabel(): string {
    const normalized = Number(this.comisionTarjeta ?? 0);
    return normalized.toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  protected orderComisionLabel(order: OrderRow): string {
    const normalized = Number(order.tarjetaComisionPorcentaje ?? this.comisionTarjeta ?? 0);
    return normalized.toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  private async loadResumenVentas(): Promise<void> {
    const requestSeq = ++this.resumenRequestSeq;
    this.cargandoResumen = true;
    this.infoMessage = '';
    const fondoInicial = await this.getConfiguredFondoForCurrentScope();

    const jornadasSeleccionadas = this.getSelectedJornadasForAppliedFilters();
    if (!jornadasSeleccionadas.length) {
      if (requestSeq !== this.resumenRequestSeq) {
        return;
      }
      this.updateEmptySummary(fondoInicial);
      this.ordersData = [];
      this.expandedOrders.clear();
      this.infoMessage = this.appliedUseDateRange
        ? 'No hay jornadas en el rango seleccionado.'
        : 'No hay jornadas disponibles para la selección actual.';
      this.cargandoResumen = false;
      return;
    }

    try {
      const ventasPorJornada = await Promise.allSettled(
        jornadasSeleccionadas.map((jornada) =>
          this.withTimeout(
            this.apiClient.get<VentaApi[]>(`/api/ventas/jornada/${jornada.id}`),
            20000,
            `La jornada #${jornada.id} tardó demasiado en responder.`,
          ),
        ),
      );
      const jornadasConError: number[] = [];
      const ventas: VentaApi[] = [];
      ventasPorJornada.forEach((resultado, index) => {
        if (resultado.status === 'fulfilled') {
          ventas.push(...resultado.value.filter((venta) => Boolean(venta.fechaCierre)));
          return;
        }
        const jornada = jornadasSeleccionadas[index];
        if (jornada?.id) {
          jornadasConError.push(jornada.id);
        }
      });

      if (!ventas.length) {
        if (requestSeq !== this.resumenRequestSeq) {
          return;
        }
        this.updateEmptySummary(fondoInicial);
        this.ordersData = [];
        this.expandedOrders.clear();
        this.infoMessage = jornadasConError.length
          ? `No se pudieron cargar las jornadas: ${jornadasConError.join(', ')}.`
          : 'No hay pedidos despachados en el rango seleccionado.';
        return;
      }

      const jornadaById = new Map(jornadasSeleccionadas.map((jornada) => [jornada.id, jornada]));
      const ordersResult = await Promise.allSettled(
        ventas.map((venta) =>
          this.withTimeout(
            Promise.all([
              this.apiClient.get<ItemVentaApi[]>(`/api/ventas/items/venta/${venta.id}`),
              this.apiClient.get<PagoApi[]>(`/api/ventas/pagos/venta/${venta.id}`),
            ]),
            20000,
            `El pedido #${venta.id} tardó demasiado en responder.`,
          ).then(([items, pagos]) => {
            const jornada = jornadaById.get(venta.jornada?.id ?? -1);
            const jornadaFecha = jornada ? this.jornadaDateLabel(jornada) : 'Sin fecha';
            return this.mapOrder(venta, items, pagos, jornadaFecha);
          }),
        ),
      );
      const pedidosConError: number[] = [];
      const orders: OrderRow[] = [];
      ordersResult.forEach((resultado, index) => {
        if (resultado.status === 'fulfilled') {
          orders.push(resultado.value);
          return;
        }
        const venta = ventas[index];
        if (venta?.id) {
          pedidosConError.push(venta.id);
        }
      });

      if (requestSeq !== this.resumenRequestSeq) {
        return;
      }

      const totalEfectivo = orders.reduce(
        (accumulator, order) => accumulator + Number(order.efectivoAmount ?? 0),
        0,
      );
      const totalTarjetaBruto = orders.reduce(
        (accumulator, order) => accumulator + Number(order.tarjetaBruto ?? 0),
        0,
      );
      const totalTarjetaNeto = orders.reduce(
        (accumulator, order) => accumulator + Number(order.tarjetaNeto ?? 0),
        0,
      );

      this.fondoInicial = fondoInicial;
      this.ordersData = orders;
      this.totalEfectivo = this.roundCurrency(totalEfectivo);
      this.totalTarjetaBruto = this.roundCurrency(totalTarjetaBruto);
      this.totalTarjetaNeto = this.roundCurrency(totalTarjetaNeto);
      this.updateCommissionFromOrders(orders);
      this.totalVentas = this.roundCurrency(fondoInicial + this.totalEfectivo + this.totalTarjetaNeto);
      if (jornadasConError.length || pedidosConError.length) {
        const errores: string[] = [];
        if (jornadasConError.length) {
          errores.push(`jornadas ${jornadasConError.join(', ')}`);
        }
        if (pedidosConError.length) {
          errores.push(`pedidos ${pedidosConError.join(', ')}`);
        }
        this.infoMessage = `Se cargó información parcial; no se pudieron consultar ${errores.join(' y ')}.`;
      }
    } catch (error) {
      if (requestSeq !== this.resumenRequestSeq) {
        return;
      }
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar el resumen de ventas.';
    } finally {
      if (requestSeq === this.resumenRequestSeq) {
        this.cargandoResumen = false;
        this.infoMessage = this.infoMessage; // fuerza dirty check
        this.changeDetector.detectChanges(); // ← pinta los cambios inmediatamente
      }
    }
  }

  private async applyConfiguredDefaults(): Promise<void> {
    const configuredFondo = await this.getConfiguredFondoForCurrentScope();
    this.fondoInicial = configuredFondo;
  }

  private async getConfiguredFondoForCurrentScope(): Promise<number> {
    await this.refreshParametrosLocal();
    if (!this.parametrosLocal) {
      return this.roundCurrency(this.fondoInicial);
    }

    const referenceDate = this.resolveFondoReferenceDate();
    return this.roundCurrency(this.resolveFondoByDate(this.parametrosLocal, referenceDate));
  }

  private async refreshParametrosLocal(): Promise<void> {
    try {
      const parametros = await this.withTimeout(
        this.apiClient.get<ParametrosLocalApi>('/api/operacion/parametros'),
        12000,
        'La consulta tardó demasiado al cargar los parámetros.',
      );
      this.parametrosLocal = parametros;
      const comision = Number(parametros.comisionBancaria ?? this.comisionTarjeta);
      if (Number.isFinite(comision) && comision >= 0) {
        this.comisionTarjeta = comision;
      }
    } catch {
      // Mantiene fallback visual en caso de no haber parámetros.
    }
  }

  private resolveFondoReferenceDate(): string {
    if (!this.hasManualConsulta) {
      return this.toIsoDate(new Date());
    }

    if (this.appliedUseDateRange) {
      const { start, end } = this.normalizedRangeFrom(this.appliedStartDate, this.appliedEndDate);
      return end || start || this.toIsoDate(new Date());
    }

    if (this.appliedJornadaId !== null && this.appliedJornadaId !== 'all') {
      const jornada = this.jornadas.find((item) => item.id === this.appliedJornadaId);
      if (jornada) {
        return this.jornadaDateKey(jornada);
      }
    }

    return this.toIsoDate(new Date());
  }

  private resolveFondoByDate(parametros: ParametrosLocalApi, isoDate: string): number {
    const fecha = this.parseIsoDate(isoDate);
    const fallback = Number(parametros.fondoLunes ?? this.fondoInicial);
    const fondoPorDia = {
      0: Number(parametros.fondoDomingo ?? fallback),
      1: Number(parametros.fondoLunes ?? fallback),
      2: Number(parametros.fondoMartes ?? fallback),
      3: Number(parametros.fondoMiercoles ?? fallback),
      4: Number(parametros.fondoJueves ?? fallback),
      5: Number(parametros.fondoViernes ?? fallback),
      6: Number(parametros.fondoSabado ?? fallback),
    } as const;
    const resolved = fondoPorDia[fecha.getDay() as keyof typeof fondoPorDia];
    return Number.isFinite(resolved) ? resolved : fallback;
  }

  private updateEmptySummary(fondoInicial: number): void {
    this.fondoInicial = this.roundCurrency(fondoInicial);
    this.totalEfectivo = 0;
    this.totalTarjetaBruto = 0;
    this.totalTarjetaNeto = 0;
    this.totalVentas = this.roundCurrency(this.fondoInicial);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async loadJornadas(): Promise<void> {
    try {
      const jornadas = await this.apiClient.get<JornadaApi[]>('/api/operacion/jornadas');
      let jornadaAbierta: JornadaApi | null = null;
      try {
        jornadaAbierta = await this.apiClient.get<JornadaApi>('/api/operacion/jornadas/estado');
      } catch {
        jornadaAbierta = null;
      }
      this.jornadaAbiertaId = jornadaAbierta?.id ?? null;
      this.jornadas = [...jornadas].sort((a, b) => {
        const fechaA = this.jornadaDateKey(a);
        const fechaB = this.jornadaDateKey(b);
        if (fechaA === fechaB) {
          return b.id - a.id;
        }
        return fechaB.localeCompare(fechaA);
      });
      this.rebuildJornadaDayInfo();
      this.updateDateBoundsFromJornadas();
      this.rangePreset = 'custom';
      if (jornadaAbierta?.fecha && this.jornadaAbiertaId !== null) {
        this.followActiveJornada = true;
        this.useDateRangeDraft = false;
        this.focusOnJornada(jornadaAbierta);
      } else {
        this.followActiveJornada = false;
        this.startDate = '';
        this.endDate = '';
        this.useDateRangeDraft = false;
        this.applyJornadaFilter();

        const lastSelection = this.readLastJornadaSelection();
        if (
          lastSelection !== null &&
          (lastSelection === 'all' || this.jornadas.some((jornada) => jornada.id === lastSelection))
        ) {
          this.selectedJornadaId = lastSelection;
        } else {
          this.selectedJornadaId = this.jornadas.length > 0 ? 'all' : null;
        }
      }

      this.saveLastJornadaSelection(this.selectedJornadaId);
      this.updatePendingState();
    } catch (error) {
      this.jornadaAbiertaId = null;
      this.jornadas = [];
      this.jornadaDayInfoById.clear();
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

    const brutoByMethodDefault = this.calculateBaseTotalsByMethod(
      pagos,
      (pago) => Number(pago.monto ?? 0),
      (pago) => Number(pago.propinaMonto ?? 0),
      'same-or-null',
    );
    const brutoByMethodAlways = this.calculateBaseTotalsByMethod(
      pagos,
      (pago) => Number(pago.monto ?? 0),
      (pago) => Number(pago.propinaMonto ?? 0),
      'always',
    );
    const targetBruto = this.roundCurrency(Number(venta.totalCuenta ?? 0));
    const selectedPolicy = this.shouldUseAlwaysTipDiscount(
      brutoByMethodDefault,
      brutoByMethodAlways,
      targetBruto,
    )
      ? 'always'
      : 'same-or-null';
    const brutoByMethod = selectedPolicy === 'always' ? brutoByMethodAlways : brutoByMethodDefault;

    const netoByMethod = this.calculateBaseTotalsByMethod(
      pagos,
      (pago) => Number(pago.montoNeto ?? 0),
      (pago) => Number(pago.propinaNeto ?? pago.propinaMonto ?? 0),
      selectedPolicy,
    );

    const tarjetaBruto = brutoByMethod.tarjeta;
    const tarjetaNeto = netoByMethod.tarjeta;
    const efectivoAmount = brutoByMethod.efectivo;
    const pagosTarjeta = pagos.filter(
      (pago) => this.resolvePaymentMethod(pago.metodoPago?.nombre) === 'tarjeta',
    );
    const tarjetaComisionPorcentaje = this.resolveOrderCardCommission(pagosTarjeta);

    const tarjetaBrutoRedondeado = this.roundCurrency(tarjetaBruto);
    const tarjetaNetoRedondeado = this.roundCurrency(tarjetaNeto);
    const efectivoRedondeado = this.roundCurrency(efectivoAmount);

    const totalBruto = this.roundCurrency(tarjetaBrutoRedondeado + efectivoRedondeado);
    const brutoFallback = totalBruto > 0 ? totalBruto : this.roundCurrency(Number(venta.totalCuenta ?? 0));
    const netoFallback = this.roundCurrency(tarjetaNetoRedondeado + efectivoRedondeado);
    const totalNeto = netoFallback > 0 ? netoFallback : brutoFallback;

    let tipoPago: OrderRow['tipoPago'] = 'efectivo';
    if (tarjetaBrutoRedondeado > 0 && efectivoRedondeado > 0) {
      tipoPago = 'mixto';
    } else if (tarjetaBrutoRedondeado > 0) {
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
      efectivoAmount: tipoPago !== 'tarjeta' ? (tipoPago === 'efectivo' ? brutoFallback : efectivoRedondeado) : undefined,
      tarjetaBruto: tipoPago !== 'efectivo' ? (tipoPago === 'tarjeta' ? brutoFallback : tarjetaBrutoRedondeado) : undefined,
      tarjetaNeto: tipoPago !== 'efectivo' ? (tipoPago === 'tarjeta' ? totalNeto : tarjetaNetoRedondeado) : undefined,
      tarjetaComisionPorcentaje,
      dishes,
    };
  }

  private isTarjetaMethod(methodName: string | undefined | null): boolean {
    return (methodName ?? '').toLowerCase().includes('tarjeta');
  }

  private isEfectivoMethod(methodName: string | undefined | null): boolean {
    return (methodName ?? '').toLowerCase().includes('efectivo');
  }

  private calculateBaseTotalsByMethod(
    pagos: PagoApi[],
    amountSelector: (pago: PagoApi) => number,
    tipSelector: (pago: PagoApi) => number,
    tipDiscountPolicy: TipDiscountPolicy,
  ): Record<PaymentMethodKey, number> {
    const totals: Record<PaymentMethodKey, number> = { efectivo: 0, tarjeta: 0 };
    for (const pago of pagos) {
      const paymentMethod = this.resolvePaymentMethod(pago.metodoPago?.nombre);
      if (!paymentMethod) {
        continue;
      }

      const amount = this.roundCurrency(amountSelector(pago));
      const tip = this.roundCurrency(tipSelector(pago));
      const tipMethod = this.resolvePaymentMethod(pago.propinaMetodoPago?.nombre);
      const shouldSubtractTip =
        tip > 0 &&
        amount + 0.0001 >= tip &&
        (tipDiscountPolicy === 'always' || tipMethod === paymentMethod || tipMethod === null);
      const baseAmount = shouldSubtractTip ? this.roundCurrency(Math.max(0, amount - tip)) : amount;
      totals[paymentMethod] = this.roundCurrency(totals[paymentMethod] + baseAmount);
    }

    return totals;
  }

  private shouldUseAlwaysTipDiscount(
    defaultTotals: Record<PaymentMethodKey, number>,
    alwaysTotals: Record<PaymentMethodKey, number>,
    targetBruto: number,
  ): boolean {
    if (!(targetBruto > 0)) {
      return true;
    }
    const defaultDiff = Math.abs(this.sumTotals(defaultTotals) - targetBruto);
    const alwaysDiff = Math.abs(this.sumTotals(alwaysTotals) - targetBruto);
    return alwaysDiff + 0.01 < defaultDiff;
  }

  private sumTotals(totals: Record<PaymentMethodKey, number>): number {
    return this.roundCurrency(Number(totals.efectivo ?? 0) + Number(totals.tarjeta ?? 0));
  }

  private resolvePaymentMethod(methodName: string | undefined | null): PaymentMethodKey | null {
    if (this.isTarjetaMethod(methodName)) {
      return 'tarjeta';
    }
    if (this.isEfectivoMethod(methodName)) {
      return 'efectivo';
    }
    return null;
  }

  private roundCurrency(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private resolveOrderCardCommission(pagosTarjeta: PagoApi[]): number | undefined {
    if (!pagosTarjeta.length) {
      return undefined;
    }

    let weightedRateSum = 0;
    let weightSum = 0;
    for (const pago of pagosTarjeta) {
      const rate = this.roundCurrency(Number(pago.comisionPorcentaje ?? 0));
      const weight = this.roundCurrency(Number(pago.monto ?? 0));
      if (rate < 0 || weight <= 0) {
        continue;
      }
      weightedRateSum += rate * weight;
      weightSum += weight;
    }

    if (weightSum <= 0) {
      return undefined;
    }
    return this.roundCurrency(weightedRateSum / weightSum);
  }

  private updateCommissionFromOrders(orders: OrderRow[]): void {
    const withCard = orders.filter((order) => Number(order.tarjetaBruto ?? 0) > 0);
    if (!withCard.length) {
      return;
    }

    let weightedRateSum = 0;
    let weightSum = 0;
    for (const order of withCard) {
      const rate = Number(order.tarjetaComisionPorcentaje ?? NaN);
      const weight = this.roundCurrency(Number(order.tarjetaBruto ?? 0));
      if (!Number.isFinite(rate) || rate < 0 || weight <= 0) {
        continue;
      }
      weightedRateSum += rate * weight;
      weightSum += weight;
    }

    if (weightSum > 0) {
      this.comisionTarjeta = this.roundCurrency(weightedRateSum / weightSum);
    }
  }

  private applyPresetDates(preset: RangePreset, referenceDate?: string): void {
    const resolvedReference = referenceDate ?? this.maxFechaConsulta ?? this.toIsoDate(new Date());
    const reference = this.parseIsoDate(resolvedReference);
    let startDate = new Date(reference);
    let endDate = new Date(reference);

    if (preset === 'weekly') {
      startDate.setDate(reference.getDate() - 6);
    } else if (preset === 'monthly') {
      startDate = new Date(reference.getFullYear(), reference.getMonth(), 1);
      endDate = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
    }

    this.startDate = this.clampDateToAvailableRange(this.toIsoDate(startDate));
    this.endDate = this.clampDateToAvailableRange(this.toIsoDate(endDate));
  }

  private applyWeeklyWindowFrom(anchorIsoDate: string, source: 'start' | 'end'): void {
    const anchor = this.clampDateToAvailableRange(anchorIsoDate);
    if (!anchor) {
      return;
    }

    if (source === 'start') {
      this.startDate = anchor;
      this.endDate = this.clampDateToAvailableRange(this.shiftIsoDate(anchor, 6));
      if (this.endDate < this.startDate) {
        this.startDate = this.shiftIsoDate(this.endDate, -6);
      }
      return;
    }

    this.endDate = anchor;
    this.startDate = this.clampDateToAvailableRange(this.shiftIsoDate(anchor, -6));
    if (this.startDate > this.endDate) {
      this.endDate = this.shiftIsoDate(this.startDate, 6);
    }
  }

  private applyMonthlyWindowFrom(anchorIsoDate: string): void {
    const anchor = this.parseIsoDate(anchorIsoDate);
    const monthStart = this.toIsoDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const monthEnd = this.toIsoDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
    this.startDate = this.clampDateToAvailableRange(monthStart);
    this.endDate = this.clampDateToAvailableRange(monthEnd);
    if (this.endDate < this.startDate) {
      this.endDate = this.startDate;
    }
  }

  private applyJornadaFilter(): void {
    if (this.useDateRangeDraft) {
      const { start, end } = this.normalizedRange();
      this.jornadasFiltradas = this.jornadas.filter((jornada) => {
        if (!start || !end) {
          return false;
        }
        const jornadaDate = this.jornadaDateKey(jornada);
        return jornadaDate >= start && jornadaDate <= end;
      });
      this.selectedJornadaId = 'all';
      return;
    }

    this.jornadasFiltradas = [...this.jornadas];
    if (!this.jornadasFiltradas.length) {
      this.selectedJornadaId = null;
      return;
    }

    if (this.selectedJornadaId === null) {
      this.selectedJornadaId = this.resolveDefaultJornadaSelection();
      return;
    }

    if (this.selectedJornadaId !== 'all' && !this.jornadasFiltradas.some((jornada) => jornada.id === this.selectedJornadaId)) {
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
    if (!this.appliedUseDateRange) {
      if (this.appliedJornadaId === null) {
        return [];
      }
      if (this.appliedJornadaId === 'all') {
        return this.jornadas;
      }
      const jornada = this.jornadas.find((item) => item.id === this.appliedJornadaId);
      return jornada ? [jornada] : [];
    }

    const jornadasEnRango = this.getJornadasByRange(this.appliedStartDate, this.appliedEndDate);
    if (this.appliedJornadaId === 'all' || this.appliedJornadaId === null) {
      return jornadasEnRango;
    }
    const jornada = jornadasEnRango.find((item) => item.id === this.appliedJornadaId);
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
      const jornadaDate = this.jornadaDateKey(jornada);
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
      .map((jornada) => this.jornadaDateKey(jornada))
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

  private clampDateToAvailableRange(isoDate: string): string {
    let normalized = this.isoDateKey(isoDate);
    if (!normalized) {
      return normalized;
    }
    if (this.minFechaConsulta && normalized < this.minFechaConsulta) {
      normalized = this.minFechaConsulta;
    }
    if (this.maxFechaConsulta && normalized > this.maxFechaConsulta) {
      normalized = this.maxFechaConsulta;
    }
    return normalized;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private shiftIsoDate(rawDate: string, days: number): string {
    const parsed = this.parseIsoDate(rawDate);
    parsed.setDate(parsed.getDate() + days);
    return this.toIsoDate(parsed);
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

  private restorePersistedFiltersState(): void {
    const cache = this.readPersistedFiltersState();
    if (!cache) {
      return;
    }

    this.rangePreset = cache.rangePreset;
    const normalizedDraftRange = this.normalizedRangeFrom(
      this.clampDateToAvailableRange(this.isoDateKey(cache.startDate)),
      this.clampDateToAvailableRange(this.isoDateKey(cache.endDate)),
    );
    this.startDate = normalizedDraftRange.start;
    this.endDate = normalizedDraftRange.end;
    this.useDateRangeDraft = Boolean(cache.useDateRangeDraft && this.startDate && this.endDate);
    this.selectedJornadaId = this.normalizeCachedJornadaSelection(cache.selectedJornadaId, this.useDateRangeDraft);

    const normalizedAppliedRange = this.normalizedRangeFrom(
      this.clampDateToAvailableRange(this.isoDateKey(cache.appliedStartDate)),
      this.clampDateToAvailableRange(this.isoDateKey(cache.appliedEndDate)),
    );
    this.appliedStartDate = normalizedAppliedRange.start;
    this.appliedEndDate = normalizedAppliedRange.end;
    this.appliedUseDateRange = Boolean(cache.appliedUseDateRange && this.appliedStartDate && this.appliedEndDate);
    this.appliedJornadaId = this.normalizeCachedJornadaSelection(cache.appliedJornadaId, this.appliedUseDateRange);

    this.hasManualConsulta = Boolean(cache.hasManualConsulta);
    this.followActiveJornada =
      Boolean(cache.followActiveJornada) &&
      this.jornadaAbiertaId !== null &&
      !this.appliedUseDateRange &&
      this.appliedJornadaId === this.jornadaAbiertaId;

    this.applyJornadaFilter();
    this.saveLastJornadaSelection(this.selectedJornadaId);
    this.updatePendingState();
  }

  private readPersistedFiltersState(): VentasFiltersCache | null {
    try {
      const raw = localStorage.getItem(SALES_FILTERS_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<VentasFiltersCache>;
      const rangePreset: RangePreset =
        parsed.rangePreset === 'weekly' || parsed.rangePreset === 'monthly' || parsed.rangePreset === 'custom'
          ? parsed.rangePreset
          : 'custom';
      return {
        rangePreset,
        startDate: this.isoDateKey(String(parsed.startDate ?? '')),
        endDate: this.isoDateKey(String(parsed.endDate ?? '')),
        selectedJornadaId:
          parsed.selectedJornadaId === 'all'
            ? 'all'
            : Number.isInteger(Number(parsed.selectedJornadaId)) && Number(parsed.selectedJornadaId) > 0
              ? Number(parsed.selectedJornadaId)
              : null,
        useDateRangeDraft: Boolean(parsed.useDateRangeDraft),
        appliedStartDate: this.isoDateKey(String(parsed.appliedStartDate ?? '')),
        appliedEndDate: this.isoDateKey(String(parsed.appliedEndDate ?? '')),
        appliedJornadaId:
          parsed.appliedJornadaId === 'all'
            ? 'all'
            : Number.isInteger(Number(parsed.appliedJornadaId)) && Number(parsed.appliedJornadaId) > 0
              ? Number(parsed.appliedJornadaId)
              : null,
        appliedUseDateRange: Boolean(parsed.appliedUseDateRange),
        followActiveJornada: Boolean(parsed.followActiveJornada),
        hasManualConsulta: Boolean(parsed.hasManualConsulta),
      };
    } catch {
      return null;
    }
  }

  private persistFiltersState(): void {
    try {
      const payload: VentasFiltersCache = {
        rangePreset: this.rangePreset,
        startDate: this.startDate,
        endDate: this.endDate,
        selectedJornadaId: this.selectedJornadaId,
        useDateRangeDraft: this.useDateRangeDraft,
        appliedStartDate: this.appliedStartDate,
        appliedEndDate: this.appliedEndDate,
        appliedJornadaId: this.appliedJornadaId,
        appliedUseDateRange: this.appliedUseDateRange,
        followActiveJornada: this.followActiveJornada,
        hasManualConsulta: this.hasManualConsulta,
      };
      localStorage.setItem(SALES_FILTERS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignora errores de storage para no bloquear la vista.
    }
  }

  private clearPersistedFiltersState(): void {
    try {
      localStorage.removeItem(SALES_FILTERS_STORAGE_KEY);
    } catch {
      // Ignora errores de storage para no bloquear la vista.
    }
  }

  private normalizeCachedJornadaSelection(
    selection: JornadaSelection | null | undefined,
    useDateRange: boolean,
  ): JornadaSelection | null {
    if (useDateRange) {
      return 'all';
    }
    if (selection === 'all') {
      return 'all';
    }
    if (selection !== null && selection !== undefined && Number.isInteger(selection)) {
      return this.jornadas.some((jornada) => jornada.id === selection)
        ? selection
        : this.jornadas.length
          ? this.resolveDefaultJornadaSelection()
          : null;
    }
    return this.jornadas.length ? this.resolveDefaultJornadaSelection() : null;
  }

  private syncAppliedFiltersWithDraft(): void {
    const { start, end } = this.normalizedRangeFrom(this.startDate, this.endDate);
    this.appliedStartDate = start;
    this.appliedEndDate = end;
    this.appliedUseDateRange = this.useDateRangeDraft;
    this.appliedJornadaId = this.appliedUseDateRange ? 'all' : this.selectedJornadaId;
    this.updatePendingState();
  }

  private updatePendingState(): void {
    const { start, end } = this.normalizedRangeFrom(this.startDate, this.endDate);
    this.filtrosPendientes =
      start !== this.appliedStartDate ||
      end !== this.appliedEndDate ||
      this.selectedJornadaId !== this.appliedJornadaId;
  }

  private hasValidDraftScopeSelection(): boolean {
    if (this.useDateRangeDraft) {
      const { start, end } = this.normalizedRangeFrom(this.startDate, this.endDate);
      return Boolean(start && end);
    }
    return this.selectedJornadaId !== null;
  }

  private hasValidAppliedScopeSelection(): boolean {
    if (this.appliedUseDateRange) {
      const { start, end } = this.normalizedRangeFrom(this.appliedStartDate, this.appliedEndDate);
      return Boolean(start && end);
    }
    return this.appliedJornadaId !== null;
  }

  private syncDraftSelectionBeforeApply(): void {
    const hasCompleteDateRange = Boolean(this.startDate && this.endDate);
    this.useDateRangeDraft = hasCompleteDateRange;
    if (hasCompleteDateRange) {
      this.selectedJornadaId = 'all';
      this.followActiveJornada = false;
      this.applyJornadaFilter();
    }
  }

  private resolveDefaultReferenceDate(): string {
    if (this.jornadaAbiertaId !== null) {
      const jornadaAbierta = this.jornadas.find((jornada) => jornada.id === this.jornadaAbiertaId);
      if (jornadaAbierta?.fecha) {
        return this.jornadaDateKey(jornadaAbierta);
      }
    }
    if (this.jornadas.length) {
      return this.jornadaDateKey(this.jornadas[0]);
    }
    return this.toIsoDate(new Date());
  }

  private jornadaDateLabel(jornada: JornadaApi): string {
    const base = this.formatDate(this.jornadaDateKey(jornada));
    const etiqueta = this.jornadaTurnLabel(jornada);
    return etiqueta ? `${base} (${etiqueta})` : base;
  }

  private jornadaTurnLabel(jornada: JornadaApi): string {
    const info = this.jornadaDayInfoById.get(jornada.id);
    if (!info || info.total <= 1) {
      return '';
    }
    return `${this.ordinalLabel(info.index)} jornada del día`;
  }

  private ordinalLabel(index: number): string {
    switch (index) {
      case 1:
        return '1ra';
      case 2:
        return '2da';
      case 3:
        return '3ra';
      default:
        return `${index}ta`;
    }
  }

  private rebuildJornadaDayInfo(): void {
    this.jornadaDayInfoById.clear();
    if (!this.jornadas.length) {
      return;
    }

    const jornadasByDate = new Map<string, JornadaApi[]>();
    this.jornadas.forEach((jornada) => {
      const fechaKey = this.jornadaDateKey(jornada);
      const group = jornadasByDate.get(fechaKey) ?? [];
      group.push(jornada);
      jornadasByDate.set(fechaKey, group);
    });

    jornadasByDate.forEach((jornadasMismoDia) => {
      jornadasMismoDia.sort((a, b) => {
        const aperturaA = new Date(a.horaApertura ?? '').getTime();
        const aperturaB = new Date(b.horaApertura ?? '').getTime();
        const safeA = Number.isFinite(aperturaA) ? aperturaA : 0;
        const safeB = Number.isFinite(aperturaB) ? aperturaB : 0;
        if (safeA === safeB) {
          return a.id - b.id;
        }
        return safeA - safeB;
      });

      const total = jornadasMismoDia.length;
      jornadasMismoDia.forEach((jornada, index) => {
        this.jornadaDayInfoById.set(jornada.id, {
          index: index + 1,
          total,
        });
      });
    });
  }

  private focusOnJornada(jornada: JornadaApi): void {
    const fecha = this.jornadaDateKey(jornada);
    this.rangePreset = 'custom';
    this.useDateRangeDraft = false;
    this.startDate = fecha;
    this.endDate = fecha;
    this.applyJornadaFilter();
    this.selectedJornadaId = this.jornadasFiltradas.some((item) => item.id === jornada.id)
      ? jornada.id
      : this.resolveDefaultJornadaSelection();
    this.updatePendingState();
  }

  private async autoApplyOpenedJornada(jornada: JornadaApi): Promise<void> {
    this.focusOnJornada(jornada);
    this.followActiveJornada = true;
    this.hasManualConsulta = true;
    this.appliedUseDateRange = false;
    this.appliedJornadaId = this.selectedJornadaId;
    this.appliedStartDate = this.startDate;
    this.appliedEndDate = this.endDate;
    this.saveLastJornadaSelection(this.selectedJornadaId);
    this.persistFiltersState();
    this.updatePendingState();
    await this.loadResumenVentas();
    this.updatePendingState();
  }

  private shouldFollowActiveJornadaAfterApply(): boolean {
    if (this.jornadaAbiertaId === null) {
      return this.followActiveJornada;
    }
    return this.appliedJornadaId !== null && this.appliedJornadaId !== 'all' && this.appliedJornadaId === this.jornadaAbiertaId;
  }

  private scheduleRealtimeRefresh(): void {
    if (this.filtrosPendientes || !this.followActiveJornada || !this.hasManualConsulta) {
      return;
    }

    if (this.realtimeRefreshTimer) {
      return;
    }

    this.realtimeRefreshTimer = setTimeout(() => {
      this.realtimeRefreshTimer = null;
      void this.loadResumenVentas();
    }, 180);
  }

  private extractPedidoJornadaId(event: any): number | null {
    const candidate =
      event?.jornadaId ??
      event?.pedido?.jornadaId ??
      event?.pedido?.jornada?.id ??
      event?.venta?.jornadaId ??
      event?.venta?.jornada?.id;

    const parsed = Number(candidate);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private isPedidoInAppliedScope(jornadaId: number): boolean {
    if (!this.appliedUseDateRange) {
      if (this.appliedJornadaId === null) {
        return false;
      }
      if (this.appliedJornadaId === 'all') {
        return true;
      }
      return this.appliedJornadaId === jornadaId;
    }

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

    const fechaJornada = this.jornadaDateKey(jornada);
    return fechaJornada >= start && fechaJornada <= end;
  }

  private jornadaDateKey(jornada: JornadaApi): string {
    const fecha = this.isoDateKey(jornada?.fecha ?? '');
    if (!jornada?.horaApertura) {
      return fecha;
    }

    const aperturaIso = this.isoDateKey(jornada.horaApertura);
    if (!fecha || aperturaIso !== fecha) {
      return fecha || aperturaIso;
    }

    // Compatibilidad con jornadas antiguas guardadas como UTC sin zona.
    const aperturaUtcLocalDate = this.isoDateAssumingUtc(jornada.horaApertura);
    if (aperturaUtcLocalDate && aperturaUtcLocalDate < fecha) {
      return aperturaUtcLocalDate;
    }

    return fecha;
  }

  private isoDateAssumingUtc(rawDateTime: string): string {
    const value = (rawDateTime ?? '').toString().trim();
    if (!value) {
      return '';
    }

    const hasTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);
    const normalized = value.includes('T') ? value : `${value}T00:00:00`;
    const parsed = new Date(hasTimezone ? normalized : `${normalized}Z`);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return this.toIsoDate(parsed);
  }

  private shouldRealtimeRefreshForPedido(jornadaId: number): boolean {
    if (!this.hasManualConsulta || this.filtrosPendientes || !this.followActiveJornada || this.appliedUseDateRange) {
      return false;
    }
    if (this.jornadaAbiertaId === null || this.appliedJornadaId === null || this.appliedJornadaId === 'all') {
      return false;
    }
    return this.appliedJornadaId === this.jornadaAbiertaId && jornadaId === this.jornadaAbiertaId;
  }
}
