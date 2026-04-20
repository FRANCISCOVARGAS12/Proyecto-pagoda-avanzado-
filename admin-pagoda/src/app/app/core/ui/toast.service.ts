import { Injectable, signal } from '@angular/core';

type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<ToastMessage[]>([]);
  private sequence = 0;

  readonly toasts = this.toastsSignal.asReadonly();

  success(text: string): void {
    this.push('success', text);
  }

  error(text: string): void {
    this.push('error', text);
  }

  info(text: string): void {
    this.push('info', text);
  }

  remove(id: number): void {
    this.toastsSignal.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private push(type: ToastType, text: string): void {
    const id = ++this.sequence;
    this.toastsSignal.update((toasts) => [...toasts, { id, type, text }]);
    setTimeout(() => this.remove(id), 3500);
  }
}
