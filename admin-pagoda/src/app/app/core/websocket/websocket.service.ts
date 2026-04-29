import { Injectable } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private client: Client | null = null;
  private connected = false;

  constructor() {
    console.log('🚀 WebSocketService inicializado');
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve();
        return;
      }

      try {
        let serverUrl: string;
        if (window.location.hostname === 'localhost') {
          serverUrl = 'http://localhost:8080/ws-pagoda';
        } else {
          serverUrl = 'https://pagoda-api-v1-1.onrender.com/ws-pagoda';
        }

        console.log('Wait... Intentando conectar a:', serverUrl);

        this.client = new Client({
          webSocketFactory: () => new SockJS(serverUrl),
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          debug: (str) => {
            console.log('STOMP Debug: ' + str);
          }
        });

        this.client.onConnect = () => {
          this.connected = true;
          console.log('✅ WebSocket conectado exitosamente');
          resolve();
        };

        this.client.onDisconnect = () => {
          this.connected = false;
          console.log('❌ WebSocket desconectado');
        };

        this.client.onStompError = (frame: any) => {
          console.error('❌ Error STOMP:', frame.body);
          resolve();
        };

        this.client.activate();

        setTimeout(() => {
          if (!this.connected) {
            console.warn('WebSocket tardando más de lo esperado...');
            resolve();
          }
        }, 6000);
      } catch (error) {
        console.warn('Error al inicializar cliente WebSocket:', error);
        resolve();
      }
    });
  }

  subscribe(destination: string, callback: (message: any) => void): void {
    if (!this.client || !this.connected) {
      console.warn('No se puede subscribir, socket no listo');
      return;
    }
    this.client.subscribe(destination, (message: any) => {
      callback(JSON.parse(message.body));
    });
  }

  disconnect(): void {
    if (this.client && this.connected) {
      this.client.deactivate();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
