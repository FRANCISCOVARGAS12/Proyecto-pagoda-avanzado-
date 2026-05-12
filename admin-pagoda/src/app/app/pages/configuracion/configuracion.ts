import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { AdminSettingsService } from '../../core/ui/admin-settings.service';
import { ToastService } from '../../core/ui/toast.service';

interface ConfigOption {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'password' | 'select' | 'number' | 'text' | 'info';
  value?: string | number | boolean;
  options?: { label: string; value: string | number }[];
  section?: string;
}

interface ParametrosLocalApi {
  id: number;
  fondoLunes: number;
  fondoMartes: number;
  fondoMiercoles: number;
  fondoJueves: number;
  fondoViernes: number;
  fondoSabado: number;
  fondoDomingo: number;
  comisionBancaria: number;
}

interface UsuarioApi {
  id: number;
  nombre: string;
  rol: string;
  activo: boolean;
}

interface RolApi {
  id: number;
  nombre: string;
}

type ThemePreference = 'auto' | 'light' | 'dark';
const THEME_KEY = 'pagoda-theme';
const USER_ID_KEY = 'pagoda-user-id';

@Component({
  selector: 'app-configuracion',
  imports: [FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.css',
})
export class Configuracion implements OnInit {
  protected options: ConfigOption[] = [
    {
      id: 'change-password',
      label: 'Cambiar PIN de acceso',
      description: 'Tu PIN actual de 6 dígitos para acceder al sistema',
      type: 'password',
      section: 'Cuenta y Acceso',
    },
    {
      id: 'theme-mode',
      label: 'Preferencia de tema',
      description: 'Elige entre claro, oscuro o automático según el sistema',
      type: 'select',
      value: 'auto',
      section: 'Cuenta y Acceso',
      options: [
        { label: 'Automático (sistema)', value: 'auto' },
        { label: 'Modo claro', value: 'light' },
        { label: 'Modo oscuro', value: 'dark' },
      ],
    },
    {
      id: 'rol-por-defecto',
      label: 'Rol por defecto',
      description: 'Rol inicial para nuevos usuarios del sistema',
      type: 'select',
      value: 'MESERO',
      section: 'Cuenta y Acceso',
      options: [
        { label: 'ADMIN', value: 'ADMIN' },
        { label: 'MESERO', value: 'MESERO' },
        { label: 'BARTENDER', value: 'BARTENDER' },
      ],
    },
    {
      id: 'fondo-caja',
      label: 'Fondo inicial de caja',
      description: 'Monto base de apertura de caja (MXN)',
      type: 'number',
      value: 2000,
      section: 'Caja y Ventas',
    },
    {
      id: 'comision-tarjeta',
      label: 'Comisión bancaria',
      description: 'Porcentaje a descontar en pagos con tarjeta',
      type: 'number',
      value: 3.5,
      section: 'Caja y Ventas',
    },
    {
      id: 'propina-sugerida',
      label: 'Propina sugerida',
      description: 'Porcentaje sugerido de propina en la venta',
      type: 'number',
      value: 10,
      section: 'Caja y Ventas',
    },
    {
      id: 'auto-logout',
      label: 'Cierre de sesión automático',
      description: 'Desconectar por inactividad (minutos)',
      type: 'number',
      value: 30,
      section: 'Operación',
    },
    {
      id: 'printer-tickets',
      label: 'Impresora de tickets',
      description: 'Dispositivo para imprimir órdenes y recibos',
      type: 'select',
      value: 'default',
      section: 'Operación',
      options: [
        { label: 'Impresora por defecto', value: 'default' },
        { label: 'Impresora térmica', value: 'thermal' },
        { label: 'Sin impresión', value: 'none' },
      ],
    },
    {
      id: 'imprimir-resumen-cierre',
      label: 'Imprimir resumen al cierre',
      description: 'Generar resumen de ventas, platillos y propinas al cerrar jornada',
      type: 'toggle',
      value: true,
      section: 'Operación',
    },
    {
      id: 'receipt-header',
      label: 'Encabezado en tickets',
      description: 'Texto personalizado que aparece en los recibos',
      type: 'text',
      value: 'Restaurante La Pagoda',
      section: 'Recibos',
    },
    {
      id: 'receipt-footer',
      label: 'Pie de página en tickets',
      description: 'Mensaje de despedida que aparece al final de los recibos',
      type: 'text',
      value: 'Gracias por su visita. ¡Vuelva pronto!',
      section: 'Recibos',
    },
    {
      id: 'mostrar-num-mesa',
      label: 'Mostrar número de mesa',
      description: 'Incluir número de mesa en tickets de cocina',
      type: 'toggle',
      value: true,
      section: 'Recibos',
    },
    {
      id: 'mostrar-comision-ticket',
      label: 'Mostrar comisión en ticket',
      description: 'Desglosar la comisión de tarjeta en el recibo',
      type: 'toggle',
      value: true,
      section: 'Recibos',
    },
  ];

  protected newPin = '';
  protected confirmPin = '';
  private backendParams: ParametrosLocalApi | null = null;

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly toastService: ToastService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.syncThemeOptionFromStorage();
    await this.loadConfig();
    this.syncUiOptionsFromSettings();
  }

  protected get sections(): string[] {
    const uniqueSections = new Set(this.options.map((option) => option.section || 'General'));
    return Array.from(uniqueSections);
  }

  protected getOptionsBySection(section: string): ConfigOption[] {
    return this.options.filter((option) => (option.section || 'General') === section);
  }

  protected async saveConfig(): Promise<void> {
    const wantsPinUpdate = Boolean(this.newPin.trim() || this.confirmPin.trim());

    if (!this.backendParams) {
      this.toastService.error('No se pudo cargar la configuración actual del backend.');
      return;
    }

    const pinUpdated = await this.updatePinIfNeeded();
    if (!pinUpdated) {
      return;
    }

    const fondoCaja = Number(this.getNumericOption('fondo-caja', 2000));
    const comision = Number(this.getNumericOption('comision-tarjeta', 3.5));

    const payload: ParametrosLocalApi = {
      ...this.backendParams,
      fondoLunes: fondoCaja,
      fondoMartes: fondoCaja,
      fondoMiercoles: fondoCaja,
      fondoJueves: fondoCaja,
      fondoViernes: fondoCaja,
      fondoSabado: fondoCaja,
      fondoDomingo: fondoCaja,
      comisionBancaria: comision,
    };

    try {
      const saved = await this.apiClient.post<ParametrosLocalApi, ParametrosLocalApi>(
        '/api/operacion/parametros',
        payload,
      );
      this.backendParams = saved;
      this.persistUiSettingsFromOptions();
      this.toastService.success(
        wantsPinUpdate
          ? 'PIN y configuración guardados correctamente.'
          : 'Configuración guardada correctamente.',
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo guardar la configuración.';
      this.toastService.error(message);
    }
  }

  protected onOptionValueChanged(option: ConfigOption): void {
    if (option.id !== 'theme-mode') {
      return;
    }

    const preference = this.normalizeThemePreference(option.value);
    this.applyThemePreference(preference);
  }

  private async loadConfig(): Promise<void> {
    try {
      const params = await this.apiClient.get<ParametrosLocalApi>('/api/operacion/parametros');
      this.backendParams = params;

      this.setOptionValue('fondo-caja', Number(params.fondoLunes));
      this.setOptionValue('comision-tarjeta', Number(params.comisionBancaria));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar la configuración del backend.';
      this.toastService.error(message);
    }
  }

  private setOptionValue(id: string, value: string | number | boolean): void {
    const option = this.options.find((item) => item.id === id);
    if (option) {
      option.value = value;
    }
  }

  private getNumericOption(id: string, fallback: number): number {
    const option = this.options.find((item) => item.id === id);
    if (!option) {
      return fallback;
    }

    const value = Number(option.value);
    return Number.isFinite(value) ? value : fallback;
  }

  private getTextOption(id: string, fallback: string): string {
    const option = this.options.find((item) => item.id === id);
    if (!option) {
      return fallback;
    }
    const value = String(option.value ?? '').trim();
    return value || fallback;
  }

  private getBooleanOption(id: string, fallback: boolean): boolean {
    const option = this.options.find((item) => item.id === id);
    if (!option) {
      return fallback;
    }
    return typeof option.value === 'boolean' ? option.value : fallback;
  }

  private getSelectOption(id: string, fallback: string): string {
    const option = this.options.find((item) => item.id === id);
    if (!option) {
      return fallback;
    }
    const value = String(option.value ?? '').trim();
    return value || fallback;
  }

  private syncThemeOptionFromStorage(): void {
    const themeOption = this.options.find((option) => option.id === 'theme-mode');
    if (!themeOption) {
      return;
    }

    const stored = localStorage.getItem(THEME_KEY);
    const preference = stored === 'light' || stored === 'dark' ? stored : 'auto';
    themeOption.value = preference;
    this.applyThemePreference(preference);
  }

  private syncUiOptionsFromSettings(): void {
    const settings = this.adminSettingsService.snapshot();
    this.setOptionValue('rol-por-defecto', settings.defaultRoleName);
    this.setOptionValue('auto-logout', settings.autoLogoutMinutes);
    this.setOptionValue('printer-tickets', settings.printerTickets);
    this.setOptionValue('imprimir-resumen-cierre', settings.printSummaryOnClose);
    this.setOptionValue('receipt-header', settings.receiptHeader);
    this.setOptionValue('receipt-footer', settings.receiptFooter);
    this.setOptionValue('mostrar-num-mesa', settings.showTableNumber);
    this.setOptionValue('mostrar-comision-ticket', settings.showTicketCommission);
    this.setOptionValue('propina-sugerida', settings.suggestedTipPercent);
  }

  private persistUiSettingsFromOptions(): void {
    const printerOption = this.getSelectOption('printer-tickets', 'default');
    const printerTickets: 'default' | 'thermal' | 'none' =
      printerOption === 'thermal' || printerOption === 'none' ? printerOption : 'default';

    this.adminSettingsService.updateSettings({
      defaultRoleName: this.getSelectOption('rol-por-defecto', 'MESERO').toUpperCase(),
      autoLogoutMinutes: this.getNumericOption('auto-logout', 30),
      printerTickets,
      printSummaryOnClose: this.getBooleanOption('imprimir-resumen-cierre', true),
      receiptHeader: this.getTextOption('receipt-header', 'Restaurante La Pagoda'),
      receiptFooter: this.getTextOption('receipt-footer', 'Gracias por su visita. ¡Vuelva pronto!'),
      showTableNumber: this.getBooleanOption('mostrar-num-mesa', true),
      showTicketCommission: this.getBooleanOption('mostrar-comision-ticket', true),
      suggestedTipPercent: this.getNumericOption('propina-sugerida', 10),
    });
  }

  private normalizeThemePreference(value: ConfigOption['value']): ThemePreference {
    return value === 'light' || value === 'dark' ? value : 'auto';
  }

  private applyThemePreference(preference: ThemePreference): void {
    let isDarkMode: boolean;

    if (preference === 'auto') {
      const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
      isDarkMode = mediaQuery?.matches ?? false;
      localStorage.removeItem(THEME_KEY);
    } else {
      isDarkMode = preference === 'dark';
      localStorage.setItem(THEME_KEY, preference);
    }

    document.documentElement.classList.toggle('dark-mode', isDarkMode);
  }

  private async updatePinIfNeeded(): Promise<boolean> {
    const pin = this.newPin.trim();
    const confirmPin = this.confirmPin.trim();

    if (!pin && !confirmPin) {
      return true;
    }

    if (!/^\d{6}$/.test(pin)) {
      this.toastService.error('El nuevo PIN debe tener exactamente 6 dígitos.');
      return false;
    }

    if (pin !== confirmPin) {
      this.toastService.error('La confirmación del PIN no coincide.');
      return false;
    }

    const userId = Number(localStorage.getItem(USER_ID_KEY));
    if (!Number.isFinite(userId)) {
      this.toastService.error('No encontramos la sesión del usuario actual.');
      return false;
    }

    try {
      const [usuario, roles] = await Promise.all([
        this.apiClient.get<UsuarioApi>(`/api/operacion/usuarios/${userId}`),
        this.apiClient.get<RolApi[]>('/api/catalogos/roles'),
      ]);

      const userRole = roles.find((role) => role.nombre === usuario.rol);
      if (!userRole) {
        this.toastService.error('No se pudo resolver el rol del usuario actual.');
        return false;
      }

      await this.apiClient.put<UsuarioApi, { nombre: string; rolId: number; pin: string; activo: boolean }>(
        `/api/operacion/usuarios/${userId}`,
        {
          nombre: usuario.nombre,
          rolId: userRole.id,
          pin,
          activo: usuario.activo,
        },
      );

      this.newPin = '';
      this.confirmPin = '';
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo actualizar el PIN.';
      this.toastService.error(message);
      return false;
    }
  }
}
