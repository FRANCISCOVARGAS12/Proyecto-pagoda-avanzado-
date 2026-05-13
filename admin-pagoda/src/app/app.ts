import { Component, effect, inject, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiClientService } from './app/core/api/api-client.service';
import { AuthService } from './app/core/auth/auth.service';
import { Jornada, JornadaService } from './app/core/jornada/jornada.service';
import { AdminSettingsService } from './app/core/ui/admin-settings.service';
import { WebSocketService } from './app/core/websocket/websocket.service';
import { ToastContainer } from './app/shared/toast-container/toast-container';
import { ToastService } from './app/core/ui/toast.service';

const THEME_KEY = 'pagoda-theme';
const USER_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

interface VentaApi {
  id: number;
  mesa: { numero: number } | null;
  jornada: { id: number } | null;
  fechaCierre: string | null;
  totalCuenta?: number;
}

interface PagoApi {
  metodoPago: { nombre: string } | null;
  propinaMetodoPago?: { nombre: string } | null;
  monto: number;
  montoNeto: number;
  comisionPorcentaje?: number;
  propinaMonto?: number;
  propinaNeto?: number;
}

interface ItemVentaApi {
  producto: { nombre: string } | null;
  precioUnitario: number;
  cantidad: number;
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

type PaymentMethodKey = 'efectivo' | 'tarjeta';
type TipDiscountPolicy = 'never' | 'same-or-null' | 'always';

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

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly apiClient = inject(ApiClientService);
  private readonly adminSettingsService = inject(AdminSettingsService);
  private readonly jornadaService = inject(JornadaService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly webSocketService = inject(WebSocketService);
  private jornadaTopicSubscribed = false;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private activityListenersRegistered = false;

  protected isDarkMode = false;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly displayName = this.authService.displayName;
  protected readonly jornadaAbierta = this.jornadaService.jornadaAbierta;

  constructor() {
    this.isDarkMode = this.getInitialTheme();
    this.applyTheme(this.isDarkMode);
    effect(() => {
      const authenticated = this.isAuthenticated();
      if (authenticated) {
        void this.initializeWebSocket();
        return;
      }

      this.jornadaTopicSubscribed = false;
      this.webSocketService.disconnect();
    });

    effect(() => {
      const authenticated = this.isAuthenticated();
      const inactivityMinutes = this.adminSettingsService.settings().autoLogoutMinutes;
      if (!authenticated) {
        this.stopInactivityTracking();
        return;
      }
      this.startInactivityTracking(inactivityMinutes);
    });
  }

  ngOnDestroy(): void {
    this.stopInactivityTracking();
    this.webSocketService.disconnect();
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      if (!this.webSocketService.isConnected()) {
        await this.webSocketService.connect();
      }

      if (!this.jornadaTopicSubscribed) {
        this.webSocketService.subscribe('/topic/jornada', (event: any) => {
          this.jornadaService.applyJornadaEvent(event);
        });
        this.jornadaTopicSubscribed = true;
      }

      await this.jornadaService.refreshCurrentJornada();
    } catch (error) {
      console.error('Error conectando a WebSocket:', error);
    }
  }

  protected toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme(this.isDarkMode);
    this.saveTheme(this.isDarkMode);
  }

  protected async cerrarJornada(): Promise<void> {
    const jornadaAbierta = this.jornadaAbierta();
    if (!jornadaAbierta) {
      return;
    }

    const result = await this.jornadaService.cerrarJornada();
    if (result.ok) {
      this.toastService.success(result.message);
      await this.generateCloseSummaryPdf(jornadaAbierta);
      return;
    }

    this.toastService.error(result.message);
  }

  protected logout(): void {
    this.stopInactivityTracking();
    this.authService.logout();
    void this.router.navigate(['/login']);
  }


  private getInitialTheme(): boolean {
    const savedTheme = this.readTheme();

    // Si hay preferencia guardada, usarla.
    if (savedTheme) {
      return savedTheme === 'dark';
    }

    // Si no hay preferencia guardada, respetar la del sistema.
    const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    return mediaQuery?.matches ?? false;
  }

  private applyTheme(isDarkMode: boolean): void {
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
  }

  private readTheme(): string | null {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch {
      return null;
    }
  }

  private saveTheme(isDarkMode: boolean): void {
    try {
      localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors; the UI theme still updates for this session.
    }
  }

  private startInactivityTracking(minutes: number): void {
    if (!this.activityListenersRegistered) {
      USER_ACTIVITY_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, this.onUserActivity, { passive: true });
      });
      this.activityListenersRegistered = true;
    }

    this.scheduleInactivityLogout(minutes);
  }

  private stopInactivityTracking(): void {
    if (this.activityListenersRegistered) {
      USER_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, this.onUserActivity);
      });
      this.activityListenersRegistered = false;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private readonly onUserActivity = (): void => {
    this.scheduleInactivityLogout(this.adminSettingsService.settings().autoLogoutMinutes);
  };

  private scheduleInactivityLogout(minutes: number): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (!this.isAuthenticated() || !Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    this.inactivityTimer = setTimeout(() => {
      if (!this.isAuthenticated()) {
        return;
      }
      this.stopInactivityTracking();
      this.authService.logout();
      this.webSocketService.disconnect();
      this.toastService.error('Sesión cerrada por inactividad.');
      void this.router.navigate(['/login']);
    }, Math.round(minutes * 60_000));
  }

  private async generateCloseSummaryPdf(jornada: Jornada): Promise<void> {
    if (!this.adminSettingsService.snapshot().printSummaryOnClose) {
      return;
    }

    try {
      const ventas = await this.apiClient.get<VentaApi[]>(`/api/ventas/jornada/${jornada.id}`);
      const ventasCerradas = ventas.filter((venta) => Boolean(venta.fechaCierre));
      const orderDetails = await Promise.all(
        ventasCerradas.map((venta) =>
          Promise.all([
            this.apiClient.get<ItemVentaApi[]>(`/api/ventas/items/venta/${venta.id}`),
            this.apiClient.get<PagoApi[]>(`/api/ventas/pagos/venta/${venta.id}`),
          ]).then(([items, pagos]) => ({ venta, items, pagos })),
        ),
      );
      const jornadaFecha = this.formatDate(jornada.fecha);
      const orders = orderDetails.map(({ venta, items, pagos }) =>
        this.mapOrder(venta, items, pagos, jornadaFecha),
      );

      const totalEfectivo = this.roundCurrency(
        orders.reduce((accumulator, order) => accumulator + Number(order.efectivoAmount ?? 0), 0),
      );
      const totalTarjetaBruto = this.roundCurrency(
        orders.reduce((accumulator, order) => accumulator + Number(order.tarjetaBruto ?? 0), 0),
      );
      const totalTarjetaNeto = this.roundCurrency(
        orders.reduce((accumulator, order) => accumulator + Number(order.tarjetaNeto ?? 0), 0),
      );

      let fondoInicial = this.roundCurrency(Number(jornada.fondoCaja ?? 0));
      try {
        const parametros = await this.apiClient.get<ParametrosLocalApi>('/api/operacion/parametros');
        fondoInicial = this.resolveFondoByDate(parametros, jornada.fecha, fondoInicial);
      } catch {
        // No bloquea la generación del PDF si parámetros no están disponibles.
      }

      await this.exportSalesReportPdf({
        filename: `resumen-cierre-jornada-${jornada.id}.pdf`,
        rangeLabel: jornadaFecha,
        scopeLabel: `#${jornada.id} · ${jornadaFecha} · CERRADA`,
        totalVentas: this.roundCurrency(fondoInicial + totalEfectivo + totalTarjetaNeto),
        fondoInicial,
        totalEfectivo,
        totalTarjetaBruto,
        totalTarjetaNeto,
        orders,
      });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'No se pudo generar el PDF de cierre.';
      this.toastService.error(message);
    }
  }

  private async exportSalesReportPdf(payload: {
    filename: string;
    rangeLabel: string;
    scopeLabel: string;
    totalVentas: number;
    fondoInicial: number;
    totalEfectivo: number;
    totalTarjetaBruto: number;
    totalTarjetaNeto: number;
    orders: OrderRow[];
  }): Promise<void> {
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
      doc.text(`Rango: ${payload.rangeLabel}`, margin, 27);
      doc.text(`Ambito: ${payload.scopeLabel}`, margin, 33);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...palette.primary);
      doc.text(this.formatMoney(payload.totalVentas), pageWidth - margin, 18, { align: 'right' });

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
      doc.text(this.formatMoney(order.totalNeto), pageWidth - margin - 4.5, y + 7.2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...palette.muted);
      doc.text(paymentLabel, pageWidth - margin - 4.5, y + 12.2, { align: 'right' });

      let innerY = y + 18;
      doc.setFontSize(9.5);
      doc.setTextColor(...palette.text);
      doc.text(`Pago: ${order.tipoPago} · Bruto: ${this.formatMoney(order.totalBruto)} · Neto: ${this.formatMoney(order.totalNeto)}`, margin + 4.5, innerY);
      innerY += 5;

      if (order.tipoPago === 'mixto') {
        doc.setTextColor(...palette.muted);
        doc.text(
          `Detalle mixto: efectivo ${this.formatMoney(order.efectivoAmount ?? 0)} + tarjeta ${this.formatMoney(order.tarjetaBruto ?? 0)} / ${this.formatMoney(order.tarjetaNeto ?? 0)}`,
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
        doc.text(this.formatMoney(dish.precio), pageWidth - margin - 4.5, innerY, { align: 'right' });
        innerY += 4.8;
      }

      y += estimatedHeight + 3;
    };

    drawHeader();

    addSectionTitle('Resumen ejecutivo');
    addKeyValue('Fondo inicial', this.formatMoney(payload.fondoInicial));
    addKeyValue('Total efectivo', this.formatMoney(payload.totalEfectivo));
    addKeyValue('Total tarjeta bruto', this.formatMoney(payload.totalTarjetaBruto));
    addKeyValue('Total tarjeta neto', this.formatMoney(payload.totalTarjetaNeto));

    addSectionTitle('Pedidos');
    if (!payload.orders.length) {
      ensureSpace(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...palette.muted);
      doc.text('Sin pedidos registrados en el ambito seleccionado.', margin, y);
      y += 7;
    }

    for (const order of payload.orders) {
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

    doc.save(payload.filename);
  }

  private mapOrder(
    venta: VentaApi,
    items: ItemVentaApi[],
    pagos: PagoApi[],
    jornadaFecha: string,
  ): OrderRow {
    const dishes = items.map((item) => {
      const cantidad = Number(item.cantidad ?? 1);
      const safeCantidad = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1;
      const precioTotal = Number(item.precioUnitario ?? 0) * safeCantidad;
      const nombreBase = item.producto?.nombre || 'Platillo';
      return {
        nombre: safeCantidad > 1 ? `${nombreBase} x${safeCantidad}` : nombreBase,
        precio: precioTotal,
      };
    });

    const dishesTotal = this.roundCurrency(
      dishes.reduce((accumulator, dish) => accumulator + this.toFiniteNumber(Number(dish.precio ?? 0)), 0),
    );
    const targetBruto = dishesTotal > 0
      ? dishesTotal
      : this.roundCurrency(Number(venta.totalCuenta ?? 0));

    const brutoByMethodNever = this.calculateBaseTotalsByMethod(
      pagos,
      (pago) => Number(pago.monto ?? 0),
      (pago) => Number(pago.propinaMonto ?? 0),
      'never',
    );
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
    const selectedPolicy = this.chooseTipDiscountPolicy(
      brutoByMethodNever,
      brutoByMethodDefault,
      brutoByMethodAlways,
      targetBruto,
    );
    const brutoByMethod = selectedPolicy === 'never'
      ? brutoByMethodNever
      : selectedPolicy === 'always'
        ? brutoByMethodAlways
        : brutoByMethodDefault;
    const netoByMethod = this.calculateBaseTotalsByMethod(
      pagos,
      (pago) => Number(pago.montoNeto ?? 0),
      (pago) => Number(pago.propinaNeto ?? pago.propinaMonto ?? 0),
      selectedPolicy,
    );

    const tarjetaBrutoRedondeado = this.roundCurrency(brutoByMethod.tarjeta);
    const tarjetaNetoRedondeado = this.roundCurrency(netoByMethod.tarjeta);
    const efectivoRedondeado = this.roundCurrency(brutoByMethod.efectivo);
    const pagosTarjeta = pagos.filter(
      (pago) => this.resolvePaymentMethod(pago.metodoPago?.nombre) === 'tarjeta',
    );

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
      efectivoAmount: tipoPago !== 'tarjeta'
        ? (tipoPago === 'efectivo' ? brutoFallback : efectivoRedondeado)
        : undefined,
      tarjetaBruto: tipoPago !== 'efectivo'
        ? (tipoPago === 'tarjeta' ? brutoFallback : tarjetaBrutoRedondeado)
        : undefined,
      tarjetaNeto: tipoPago !== 'efectivo'
        ? (tipoPago === 'tarjeta' ? totalNeto : tarjetaNetoRedondeado)
        : undefined,
      tarjetaComisionPorcentaje: this.resolveOrderCardCommission(pagosTarjeta, selectedPolicy),
      dishes,
    };
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

      const amount = this.toFiniteNumber(amountSelector(pago));
      const tip = this.normalizeTipValue(pago, this.toFiniteNumber(tipSelector(pago)));
      const tipMethod = this.resolvePaymentMethod(pago.propinaMetodoPago?.nombre);
      const shouldSubtractTip =
        tipDiscountPolicy !== 'never' &&
        tip > 0 &&
        amount + 0.0001 >= tip &&
        (tipDiscountPolicy === 'always' || tipMethod === paymentMethod || tipMethod === null);
      const baseAmount = shouldSubtractTip ? Math.max(0, amount - tip) : amount;
      totals[paymentMethod] = this.toFiniteNumber(totals[paymentMethod]) + baseAmount;
    }

    return totals;
  }

  private chooseTipDiscountPolicy(
    neverTotals: Record<PaymentMethodKey, number>,
    defaultTotals: Record<PaymentMethodKey, number>,
    alwaysTotals: Record<PaymentMethodKey, number>,
    targetBruto: number,
  ): TipDiscountPolicy {
    if (!(targetBruto > 0)) {
      return 'never';
    }
    const candidates: Array<{ policy: TipDiscountPolicy; diff: number }> = [
      { policy: 'never', diff: Math.abs(this.sumTotals(neverTotals) - targetBruto) },
      { policy: 'same-or-null', diff: Math.abs(this.sumTotals(defaultTotals) - targetBruto) },
      { policy: 'always', diff: Math.abs(this.sumTotals(alwaysTotals) - targetBruto) },
    ];
    candidates.sort((a, b) => a.diff - b.diff);
    return candidates[0]?.policy ?? 'never';
  }

  private resolveOrderCardCommission(
    pagosTarjeta: PagoApi[],
    tipDiscountPolicy: TipDiscountPolicy,
  ): number | undefined {
    if (!pagosTarjeta.length) {
      return undefined;
    }

    let weightedRateSum = 0;
    let weightSum = 0;
    for (const pago of pagosTarjeta) {
      const rate = this.toFiniteNumber(Number(pago.comisionPorcentaje ?? 0));
      const amount = this.toFiniteNumber(Number(pago.monto ?? 0));
      const tip = this.normalizeTipValue(pago, this.toFiniteNumber(Number(pago.propinaMonto ?? 0)));
      const tipMethod = this.resolvePaymentMethod(pago.propinaMetodoPago?.nombre);
      const shouldSubtractTip =
        tipDiscountPolicy !== 'never' &&
        tip > 0 &&
        amount + 0.0001 >= tip &&
        (tipDiscountPolicy === 'always' || tipMethod === 'tarjeta' || tipMethod === null);
      const weight = shouldSubtractTip ? Math.max(0, amount - tip) : amount;
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

  private resolvePaymentMethod(methodName: string | undefined | null): PaymentMethodKey | null {
    const normalized = (methodName ?? '').toLowerCase();
    if (normalized.includes('tarjeta')) {
      return 'tarjeta';
    }
    if (normalized.includes('efectivo')) {
      return 'efectivo';
    }
    return null;
  }

  private normalizeTipValue(pago: PagoApi, tipValue: number): number {
    const tipAmount = this.toFiniteNumber(Number(pago.propinaMonto ?? 0));
    if (tipAmount <= 0) {
      return Math.max(0, tipValue);
    }
    return Math.min(Math.max(0, tipValue), tipAmount);
  }

  private resolveFondoByDate(parametros: ParametrosLocalApi, isoDate: string, fallback: number): number {
    const fecha = this.parseIsoDate(isoDate);
    const baseFallback = Number.isFinite(fallback) ? fallback : Number(parametros.fondoLunes ?? 0);
    const fondoPorDia = {
      0: Number(parametros.fondoDomingo ?? baseFallback),
      1: Number(parametros.fondoLunes ?? baseFallback),
      2: Number(parametros.fondoMartes ?? baseFallback),
      3: Number(parametros.fondoMiercoles ?? baseFallback),
      4: Number(parametros.fondoJueves ?? baseFallback),
      5: Number(parametros.fondoViernes ?? baseFallback),
      6: Number(parametros.fondoSabado ?? baseFallback),
    } as const;
    const resolved = fondoPorDia[fecha.getDay() as keyof typeof fondoPorDia];
    return this.roundCurrency(Number.isFinite(resolved) ? resolved : baseFallback);
  }

  private sumTotals(totals: Record<PaymentMethodKey, number>): number {
    return this.roundCurrency(Number(totals.efectivo ?? 0) + Number(totals.tarjeta ?? 0));
  }

  private roundCurrency(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toFiniteNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }

  private formatMoney(value: number): string {
    const normalized = this.roundCurrency(value);
    return `$${normalized.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatDate(rawDate: string): string {
    const iso = this.isoDateKey(rawDate);
    if (!iso || iso.length < 10) return iso;
    const [, month, day] = iso.split('-');
    const year = iso.slice(0, 4);
    return `${day}/${month}/${year}`;
  }

  private isoDateKey(rawDate: string): string {
    return (rawDate ?? '').toString().slice(0, 10);
  }

  private parseIsoDate(rawDate: string): Date {
    const normalized = this.isoDateKey(rawDate);
    const parsed = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
