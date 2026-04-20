import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClientService } from '../../core/api/api-client.service';
import { JornadaService } from '../../core/jornada/jornada.service';

interface ResumenPropinaApi {
  totalPropinasNeto: number;
}

@Component({
  selector: 'app-propinas',
  imports: [FormsModule],
  templateUrl: './propinas.html',
  styleUrl: './propinas.css',
})
export class Propinas implements OnInit {
  protected startDate = '2026-02-24';
  protected endDate = '2026-03-02';
  protected totalPropinas = 0;
  protected infoMessage = '';

  constructor(
    private readonly apiClient: ApiClientService,
    private readonly jornadaService: JornadaService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadPropinas();
  }

  private async loadPropinas(): Promise<void> {
    this.infoMessage = '';
    await this.jornadaService.refreshJornada();
    const jornada = this.jornadaService.jornadaAbierta();

    if (!jornada) {
      this.totalPropinas = 0;
      this.infoMessage = 'No hay jornada activa para consultar propinas.';
      return;
    }

    try {
      const resumen = await this.apiClient.get<ResumenPropinaApi[]>(
        `/api/reportes/propinas-diarias/jornada/${jornada.id}`,
      );

      this.totalPropinas = resumen.reduce(
        (accumulator, item) => accumulator + Number(item.totalPropinasNeto ?? 0),
        0,
      );

      if (!resumen.length) {
        this.infoMessage = 'No hay datos de propinas para la jornada activa.';
      }
    } catch (error) {
      this.totalPropinas = 0;
      this.infoMessage =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo cargar el reporte de propinas.';
    }
  }
}
