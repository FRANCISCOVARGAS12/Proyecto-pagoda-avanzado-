import { Injectable } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private client: Client;
  private connected = false;

  constructor() {
    this.client = new Client({
      brokerURL: 'ws://localhost:8080/ws-pagoda',
      connectHeaders: {},
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.client.onConnect = () => {
      this.connected = true;
      console.log('✅ WebSocket conectado');
    };

    this.client.onDisconnect = () => {
      this.connected = false;
      console.log('❌ WebSocket desconectado');
    };

    this.client.onStompError = (frame: any) => {
      console.error('❌ Error STOMP:', frame.body);
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.connected) {
        resolve();
      } else {
        this.client.onConnect = () => {
          this.connected = true;
          console.log('✅ WebSocket conectado');
          resolve();
        };
        this.client.activate();
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      }
    });
  }

  subscribe(destination: string, callback: (message: any) => void): void {
    if (!this.connected) {
      console.warn('WebSocket no conectado, reintentando subscripción...');
      this.connect().then(() => this.subscribe(destination, callback));
      return;
    }

    this.client.subscribe(destination, (message: any) => {
      try {
        const body = JSON.parse(message.body);
        callback(body);
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
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
