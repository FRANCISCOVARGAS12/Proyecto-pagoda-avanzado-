import { Injectable, signal } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export interface Jornada {
  id: number;
  fecha: string;
  fondoCaja: number;
  horaApertura: string;
  horaCierre?: string;
  estado: 'ABIERTA' | 'CERRADA';
}

interface UsuarioRef {
  id: number;
}

interface JornadaApi {
  id: number;
  fecha: string;
  fondoCaja: number;
  horaApertura: string;
  horaCierre: string | null;
  estado: string;
  usuarioApertura: UsuarioRef | null;
  usuarioCierre: UsuarioRef | null;
}

@Injectable({ providedIn: 'root' })
export class JornadaService {
  private readonly jornadaAbiertaSignal = signal<Jornada | null>(null);
  readonly jornadaAbierta = this.jornadaAbiertaSignal.asReadonly();

  constructor(private readonly apiClient: ApiClientService) {
    void this.refreshJornada();
  }

  async refreshJornada(): Promise<void> {
    const jornadaApi = await this.apiClient.getOrNull<JornadaApi>('/api/operacion/jornadas/estado');

    if (!jornadaApi || jornadaApi.estado !== 'ABIERTA') {
      this.jornadaAbiertaSignal.set(null);
      return;
    }

    this.jornadaAbiertaSignal.set(this.mapJornada(jornadaApi));
  }

  // Alias para WebSocket
  async refreshCurrentJornada(): Promise<void> {
    return this.refreshJornada();
  }

  async cerrarJornada(): Promise<{ ok: boolean; message: string }> {
    const jornada = this.jornadaAbiertaSignal();

    if (!jornada) {
      return { ok: false, message: 'No hay una jornada abierta.' };
    }

    try {
      await this.apiClient.put<JornadaApi, Record<string, never>>(
        `/api/operacion/jornadas/cerrar/${jornada.id}`,
        {},
      );
      this.jornadaAbiertaSignal.set(null);
      return { ok: true, message: 'Jornada cerrada correctamente.' };
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cerrar la jornada.';
      return { ok: false, message };
    }
  }

  private mapJornada(jornada: JornadaApi): Jornada {
    return {
      id: jornada.id,
      fecha: jornada.fecha,
      fondoCaja: Number(jornada.fondoCaja),
      horaApertura: jornada.horaApertura,
      horaCierre: jornada.horaCierre ?? undefined,
      estado: jornada.estado === 'CERRADA' ? 'CERRADA' : 'ABIERTA',
    };
  }
}
