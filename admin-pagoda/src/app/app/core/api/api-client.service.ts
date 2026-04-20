import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { ApiResponse } from './api.types';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  async get<T>(path: string): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<T>>(`${API_BASE_URL}${path}`),
      );
      return this.unwrapResponse(response);
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  async getOrNull<T>(path: string): Promise<T | null> {
    try {
      return await this.get<T>(path);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async post<TResponse, TBody>(path: string, payload: TBody): Promise<TResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<TResponse>>(`${API_BASE_URL}${path}`, payload),
      );
      return this.unwrapResponse(response);
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  async put<TResponse, TBody>(path: string, payload: TBody): Promise<TResponse> {
    try {
      const response = await firstValueFrom(
        this.http.put<ApiResponse<TResponse>>(`${API_BASE_URL}${path}`, payload),
      );
      return this.unwrapResponse(response);
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  async delete(path: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.delete<ApiResponse<null>>(`${API_BASE_URL}${path}`),
      );

      if (!response.success) {
        throw new Error(response.message || 'No se pudo eliminar el registro.');
      }
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  private unwrapResponse<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new Error(response.message || 'La API devolvio un error.');
    }

    if (response.data === null) {
      throw new Error(response.message || 'La API no devolvio datos.');
    }

    return response.data;
  }

  private handleHttpError(error: unknown): never {
    if (error instanceof HttpErrorResponse) {
      const apiError = error.error as Partial<ApiResponse<unknown>> | undefined;
      if (apiError?.message && typeof apiError.message === 'string') {
        throw new Error(apiError.message);
      }

      throw new Error(error.message || 'No se pudo completar la solicitud.');
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Error de comunicación con el servidor.');
  }
}
