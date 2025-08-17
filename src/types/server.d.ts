import type { Express } from 'express';
import type { Logger } from 'pino';
import type { Server as HttpServer, IncomingMessage } from 'http';
import type { Server as WebSocketServer, WebSocket, RawData } from 'ws';
import type SessionManager from './sessions';

export interface ServerWebSocket extends WebSocket {
  isAlive?: boolean;
  sessionId?: string | null;
  clientId?: string | null;
}

export class TimerServer {
  logger: Logger;
  express: Express;
  server: HttpServer;
  host: string;
  port: number;
  wss: WebSocketServer | null;
  wsPort: number | string;
  sessions: SessionManager;

  constructor();
  setupExpress(): void;
  setupWebSocket(): void;
  setupRoutes(): void;
  setupErrorHandling(): void;
  handleWebSocketConnection(ws: ServerWebSocket, req: IncomingMessage): void;
  handleWebSocketMessage(ws: ServerWebSocket, message: RawData): void;
  handleWebSocketClose(ws: ServerWebSocket, code: number, reason: string): void;
  sendError(ws: ServerWebSocket, message: string): void;
  start(): void;
  stop(signal: string): void;
}

export type { Express, HttpServer, IncomingMessage, WebSocketServer, WebSocket };
