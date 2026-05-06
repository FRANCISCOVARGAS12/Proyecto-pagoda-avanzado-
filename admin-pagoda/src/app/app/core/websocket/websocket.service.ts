import { Injectable } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Observable } from 'rxjs';
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
  private connecting = false;
  private connectResolvers: Array<() => void> = [];
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private subscriptions = new Map<number, WsSubscription>();
  private nextSubscriptionId = 1;

  constructor() {
    console.log('🚀 WebSocketService inicializado');
  }

  connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    if (!this.client) {
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
        this.connecting = false;
        this.clearConnectTimeout();
        console.log('✅ WebSocket conectado');
        this.restoreSubscriptions();
        this.resolvePendingConnects();
      };

      this.client.onDisconnect = () => {
        this.connected = false;
        this.connecting = false;
        this.resetSubscriptionHandles();
        console.log('❌ WebSocket desconectado');
      };

      this.client.onStompError = (frame: any) => {
        console.error('Error STOMP:', frame.body);
        this.connecting = false;
        this.clearConnectTimeout();
        this.resolvePendingConnects();
      };
    }

    if (!this.connecting) {
      this.connecting = true;
      if (this.client && !this.client.active) {
        this.client.activate();
      }
      this.ensureConnectTimeout();
    }

    return new Promise((resolve) => {
      this.connectResolvers.push(resolve);
    });
  }

  subscribe(destination: string, callback: (message: any) => void): () => void;
  subscribe(destination: string): Observable<any>;
  subscribe(destination: string, callback?: (message: any) => void): (() => void) | Observable<any> {
    if (!callback) {
      return new Observable<any>((observer) => {
        const unsubscribe = this.subscribe(destination, (message: any) => observer.next(message));
        return () => unsubscribe();
      });
    }

    const id = this.nextSubscriptionId++;
    const subscription: WsSubscription = {
      id,
      destination,
      callback,
      stompSubscription: null,
    };

    this.subscriptions.set(id, subscription);
    this.bindSubscription(subscription);
    if (!this.connected) {
      void this.connect();
    }

    return () => this.unsubscribe(id);
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
    }
    this.connected = false;
    this.connecting = false;
    this.clearConnectTimeout();
    this.resolvePendingConnects();
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

  private ensureConnectTimeout(): void {
    if (this.connectTimeoutId) {
      return;
    }
    this.connectTimeoutId = setTimeout(() => {
      if (!this.connected) {
        console.warn('WebSocket tardando más de lo esperado...');
      }
      this.connecting = false;
      this.clearConnectTimeout();
      this.resolvePendingConnects();
    }, 8000);
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
  }

  private resolvePendingConnects(): void {
    const resolvers = [...this.connectResolvers];
    this.connectResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }
}
