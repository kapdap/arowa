import type WebSocket from 'ws';
import type { Logger } from 'pino';
import type { IncomingMessage, SessionInternal } from './messages';

export interface ServerWebSocket extends WebSocket {
  logger: Logger;
  isAlive?: boolean;
  sessionId?: string | null;
  clientId?: string | null;
}

declare class SessionManager {
  getSession(sessionId: string): SessionInternal | null;
  handleMessage(ws: ServerWebSocket, data: IncomingMessage): void;
  removeClient(sessionId: string, clientId: string): void;
  dispose(): void;
}

export default SessionManager;
