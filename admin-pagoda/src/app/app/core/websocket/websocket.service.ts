import { Injectable } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

interface WsSubscription {
  id: number;
  destination: string;
  callback: (message: any) => void;
  stompSubscription: StompSubscription | null;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private client: Client | null = null;
  private connected = false;
  private subscriptions = new Map<number, WsSubscription>();
  private nextSubscriptionId = 1;

  constructor() {
    console.log('🚀 WebSocketService inicializado');
  }

  connect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve();
        return;
      }

      if (this.client?.active) {
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
        this.restoreSubscriptions();
        resolve();
      };

      this.client.onDisconnect = () => {
        this.connected = false;
        this.resetSubscriptionHandles();
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
   * Suscribirse a un destino.
   * Regresa una función para cancelar la suscripción.
   */
  subscribe(destination: string, callback: (message: any) => void): () => void {
    const id = this.nextSubscriptionId++;
    const subscription: WsSubscription = {
      id,
      destination,
      callback,
      stompSubscription: null,
    };

    this.subscriptions.set(id, subscription);
    this.bindSubscription(subscription);

    return () => this.unsubscribe(id);
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
    }
    this.connected = false;
    this.resetSubscriptionHandles();
    this.subscriptions.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private unsubscribe(id: number): void {
    const subscription = this.subscriptions.get(id);
    if (!subscription) {
      return;
    }

    subscription.stompSubscription?.unsubscribe();
    this.subscriptions.delete(id);
  }

  private bindSubscription(subscription: WsSubscription): void {
    if (!this.client || !this.connected) {
      return;
    }

    subscription.stompSubscription?.unsubscribe();
    subscription.stompSubscription = this.client.subscribe(subscription.destination, (msg: any) => {
      try {
        subscription.callback(JSON.parse(msg.body));
      } catch (error) {
        console.error(`Error parseando mensaje de ${subscription.destination}:`, error);
      }
    });
  }

  private restoreSubscriptions(): void {
    this.subscriptions.forEach((subscription) => {
      this.bindSubscription(subscription);
    });
  }

  private resetSubscriptionHandles(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.stompSubscription = null;
    });
  }
}
