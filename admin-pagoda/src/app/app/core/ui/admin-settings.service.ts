import { Injectable, signal } from '@angular/core';

export interface AdminUiSettings {
  defaultRoleName: string;
  autoLogoutMinutes: number;
  printerTickets: 'default' | 'thermal' | 'none';
  printSummaryOnClose: boolean;
  receiptHeader: string;
  receiptFooter: string;
  showTableNumber: boolean;
  showTicketCommission: boolean;
  suggestedTipPercent: number;
}

const SETTINGS_KEY = 'pagoda-admin-ui-settings';

const DEFAULT_SETTINGS: AdminUiSettings = {
  defaultRoleName: 'MESERO',
  autoLogoutMinutes: 30,
  printerTickets: 'default',
  printSummaryOnClose: true,
  receiptHeader: 'Restaurante La Pagoda',
  receiptFooter: 'Gracias por su visita. ¡Vuelva pronto!',
  showTableNumber: true,
  showTicketCommission: true,
  suggestedTipPercent: 10,
};

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private readonly settingsSignal = signal<AdminUiSettings>(this.loadSettings());
  readonly settings = this.settingsSignal.asReadonly();

  snapshot(): AdminUiSettings {
    return this.settingsSignal();
  }

  updateSettings(partial: Partial<AdminUiSettings>): void {
    const next = this.normalizeSettings({ ...this.settingsSignal(), ...partial });
    this.settingsSignal.set(next);
    this.persistSettings(next);
  }

  private loadSettings(): AdminUiSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }
      const parsed = JSON.parse(raw) as Partial<AdminUiSettings>;
      return this.normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private persistSettings(settings: AdminUiSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignora errores de storage para no bloquear la app.
    }
  }

  private normalizeSettings(raw: AdminUiSettings): AdminUiSettings {
    const normalizedRole = (raw.defaultRoleName ?? DEFAULT_SETTINGS.defaultRoleName)
      .toString()
      .trim()
      .toUpperCase();
    const printer =
      raw.printerTickets === 'thermal' || raw.printerTickets === 'none' || raw.printerTickets === 'default'
        ? raw.printerTickets
        : DEFAULT_SETTINGS.printerTickets;

    const autoLogout = Number(raw.autoLogoutMinutes);
    const tipPercent = Number(raw.suggestedTipPercent);

    return {
      defaultRoleName: normalizedRole || DEFAULT_SETTINGS.defaultRoleName,
      autoLogoutMinutes: Number.isFinite(autoLogout) && autoLogout >= 0 ? autoLogout : DEFAULT_SETTINGS.autoLogoutMinutes,
      printerTickets: printer,
      printSummaryOnClose: raw.printSummaryOnClose ?? DEFAULT_SETTINGS.printSummaryOnClose,
      receiptHeader: String(raw.receiptHeader ?? DEFAULT_SETTINGS.receiptHeader).trim() || DEFAULT_SETTINGS.receiptHeader,
      receiptFooter: String(raw.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter).trim() || DEFAULT_SETTINGS.receiptFooter,
      showTableNumber: raw.showTableNumber ?? DEFAULT_SETTINGS.showTableNumber,
      showTicketCommission: raw.showTicketCommission ?? DEFAULT_SETTINGS.showTicketCommission,
      suggestedTipPercent: Number.isFinite(tipPercent) && tipPercent >= 0 ? tipPercent : DEFAULT_SETTINGS.suggestedTipPercent,
    };
  }
}
