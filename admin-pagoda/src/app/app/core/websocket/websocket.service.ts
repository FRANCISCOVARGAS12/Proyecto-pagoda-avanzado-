import { Injectable } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private client: Client | null = null;
  private connected = false;
  // Cola de suscripciones pendientes hasta que la conexión esté lista
  private pendingSubscriptions: Array<{ destination: string; callback: (message: any) => void }> = [];

  constructor() {
    console.log('🚀 WebSocketService inicializado');
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve();
        return;
      }

      const serverUrl = 'https://pagoda-api-v1-1.onrender.com/ws-pagoda';
      console.log('Conectando a:', serverUrl);

      this.client = new Client({
        webSocketFactory: () => new SockJS(serverUrl),
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        debug: (str) => console.log('STOMP:', str)
      });

      this.client.onConnect = () => {
        this.connected = true;
        console.log('✅ WebSocket conectado');

        // Volcar todas las suscripciones que llegaron mientras tanto
        this.pendingSubscriptions.forEach(sub => {
          this.client?.subscribe(sub.destination, (msg: any) => {
            sub.callback(JSON.parse(msg.body));
          });
        });
        this.pendingSubscriptions = []; // limpiar cola
        resolve();
      };

      this.client.onDisconnect = () => {
        this.connected = false;
        console.log('❌ WebSocket desconectado');
      };

      this.client.onStompError = (frame: any) => {
        console.error('Error STOMP:', frame.body);
        resolve();
      };

      this.client.activate();

      setTimeout(() => {
        if (!this.connected) {
          console.warn('WebSocket tardando más de lo esperado...');
          resolve();
        }
      }, 6000);
    });
  }

  /**
   * Suscribirse a un destino. Si la conexión no está lista, la encola.
   */
  subscribe(destination: string, callback: (message: any) => void): void {
    if (!this.client || !this.connected) {
      // Todavía no conectados; guardar para más tarde
      console.log(`⏳ Encolando suscripción a ${destination}`);
      this.pendingSubscriptions.push({ destination, callback });
      return;
    }
    this.client.subscribe(destination, (msg: any) => {
      callback(JSON.parse(msg.body));
    });
  }

  disconnect(): void {
    if (this.client && this.connected) {
      this.client.deactivate();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
