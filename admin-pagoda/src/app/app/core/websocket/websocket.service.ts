import { Injectable } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private client: Client | null = null;
  private connected = false;

  constructor() {}

  connect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve();
        return;
      }

      try {
        // Para SockJS usamos http/https, NO ws/wss
        let serverUrl: string;
        if (window.location.hostname === 'localhost') {
          serverUrl = 'http://localhost:8080/ws-pagoda';
        } else {
          serverUrl = 'https://pagoda-api-v1-1.onrender.com/ws-pagoda';
        }

        this.client = new Client({
          // CLAVE: Usamos webSocketFactory porque el back tiene .withSockJS()
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
          console.log('✅ WebSocket conectado exitosamente a:', serverUrl);
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
            console.warn('WebSocket no disponible a tiempo, continuando...');
            resolve();
          }
        }, 5000); // Aumentamos a 5s por si Render tarda en responder
      } catch (error) {
        console.warn('No se pudo inicializar WebSocket:', error);
        resolve();
      }
    });
  }

  subscribe(destination: string, callback: (message: any) => void): void {
    if (!this.client || !this.connected) {
      console.warn('WebSocket no conectado, saltando subscripción a', destination);
      return;
    }

    try {
      this.client.subscribe(destination, (message: any) => {
        try {
          const body = JSON.parse(message.body);
          callback(body);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      });
    } catch (error) {
      console.warn('Error subscribiendo a', destination, error);
    }
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
