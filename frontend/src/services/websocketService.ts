import { AppDispatch } from '../store';
import { updateParkingSpots } from '../store/slices/parkingSlice';

type WebSocketConfig = {
  url: string;
  dispatch: AppDispatch;
  onOpen?: () => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
};

class WebSocketService {
  private socket: WebSocket | null = null;
  private dispatch: AppDispatch;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private onOpenCallback?: () => void;
  private onErrorCallback?: (error: Event) => void;
  private onCloseCallback?: (event: CloseEvent) => void;

  constructor(config: WebSocketConfig) {
    this.url = config.url;
    this.dispatch = config.dispatch;
    this.onOpenCallback = config.onOpen;
    this.onErrorCallback = config.onError;
    this.onCloseCallback = config.onClose;
  }

  public connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected');
      return;
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onclose = this.handleClose.bind(this);

      console.log(`Connecting to WebSocket at ${this.url}...`);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.attemptReconnect();
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempts = 0;
    console.log('WebSocket disconnected');
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  private handleOpen(event: Event): void {
    console.log('WebSocket connection established');
    this.reconnectAttempts = 0;
    
    if (this.onOpenCallback) {
      this.onOpenCallback();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      
      // Handle different message types
      if (data.type === 'parking_update' && Array.isArray(data.data)) {
        this.dispatch(updateParkingSpots(data.data));
      } 
      // Handle legacy format (array of parking spots directly)
      else if (Array.isArray(data)) {
        this.dispatch(updateParkingSpots(data));
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
    
    if (this.onErrorCallback) {
      this.onErrorCallback(event);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    
    if (this.onCloseCallback) {
      this.onCloseCallback(event);
    }
    
    // Attempt to reconnect if the connection was closed unexpectedly
    if (event.code !== 1000) { // 1000 is normal closure
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Maximum reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff with max 30s

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }
}

// Create singleton instances for backend and ML service
let backendWebSocket: WebSocketService | null = null;
let mlServiceWebSocket: WebSocketService | null = null;

export const getBackendWebSocket = (dispatch: AppDispatch): WebSocketService => {
  if (!backendWebSocket) {
    backendWebSocket = new WebSocketService({
      url: 'ws://localhost:8000/ws',
      dispatch,
    });
  }
  return backendWebSocket;
};

export const getMLServiceWebSocket = (dispatch: AppDispatch): WebSocketService => {
  if (!mlServiceWebSocket) {
    mlServiceWebSocket = new WebSocketService({
      url: 'ws://localhost:8001/ws',
      dispatch,
    });
  }
  return mlServiceWebSocket;
};

export default WebSocketService;