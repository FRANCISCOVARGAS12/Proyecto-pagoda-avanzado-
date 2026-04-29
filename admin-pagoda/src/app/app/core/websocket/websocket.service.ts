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
    // Don't initialize in constructor - wait for connect()
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve();
        return;
      }

      try {
        // Determine WebSocket URL based on environment
        let wsUrl: string;
        if (window.location.hostname === 'localhost') {
          // Local development
          wsUrl = 'ws://localhost:8080/ws-pagoda';
        } else {
          // Production - connect to Render backend
          wsUrl = 'wss://pagoda-api-v1-1.onrender.com/ws-pagoda';
        }

        this.client = new Client({
          brokerURL: wsUrl,
          connectHeaders: {},
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
        });

        this.client.onConnect = () => {
          this.connected = true;
          console.log('✅ WebSocket conectado a:', wsUrl);
          resolve();
        };

        this.client.onDisconnect = () => {
          this.connected = false;
          console.log('❌ WebSocket desconectado');
        };

        this.client.onStompError = (frame: any) => {
          console.error('❌ Error STOMP:', frame.body);
          // No rechazar, solo log - permite que la app continúe
          resolve();
        };

        this.client.activate();
        
        // Timeout para no bloquear la app
        setTimeout(() => {
          if (!this.connected) {
            console.warn('WebSocket no disponible, continuando sin tiempo real');
            resolve();
          }
        }, 3000);
      } catch (error) {
        console.warn('No se pudo inicializar WebSocket:', error);
        resolve(); // No rechazar para que la app siga funcionando
      }
    });
  }

  subscribe(destination: string, callback: (message: any) => void): void {
    if (!this.client || !this.connected) {
      console.warn('WebSocket no conectado, saltando subscripción a', destination);
      return; // Silenciosamente ignorar si no está conectado
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
