/**
 * Session management for the collaborative timer server.
 */

import type { Logger } from 'pino';
import type { ServerWebSocket } from '../types/server';
import type {
  ErrorMessage,
  IncomingMessage,
  OutgoingMessage,
  SessionInternal,
  SessionUpdate,
  TimerState,
  UserInternal,
} from '../types/messages';
import {
  formatClientId,
  formatUsersConnectedMsg,
  formatErrorMsg,
  formatIncoming,
  formatInternalSession,
  formatInternalUser,
  formatSessionCreatedMsg,
  formatSessionJoinedMsg,
  formatSessionUpdatedMsg,
  formatTimerUpdatedMsg,
  formatUserConnectedMsg,
  formatUserDisconnectedMsg,
  formatUserUpdatedMsg,
  hashString,
  generateUUID,
} from './messages.js';
import { createLogger } from './logger.js';

const CLEANUP_INTERVAL = Number(process.env.CLEANUP_INTERVAL) || 300000;
const SESSION_TIMEOUT = 10 * 60 * 1000;

/**
 * Session manager class for handling real-time collaboration.
 */
class SessionManager {
  private logger: Logger;
  private handlers: Map<string, (ws: ServerWebSocket, message: IncomingMessage) => void>;
  private sessions: Map<string, SessionInternal>;
  private sockets: Map<string, ServerWebSocket>;
  private cleanup: NodeJS.Timeout | null;

  /**
   * Initialize session manager, message handlers, sessions, sockets, and cleanup timer.
   */
  constructor() {
    this.logger = createLogger('session-manager');
    this.handlers = new Map();
    this.sessions = new Map();
    this.sockets = new Map();
    this.cleanup = null;

    this.setupHandlers();
    this.startCleanup();
  }

  /**
   * Register message handlers for supported message types.
   */
  private setupHandlers(): void {
    this.handlers.set('session_join', this.handleSessionJoin.bind(this));
    this.handlers.set('session_update', this.handleSessionUpdate.bind(this));
    this.handlers.set('timer_update', this.handleTimerUpdate.bind(this));
    this.handlers.set('user_update', this.handleUserUpdate.bind(this));
    this.handlers.set('user_list', this.handleUserList.bind(this));
  }

  /**
   * Handle incoming WebSocket message and dispatch to appropriate handler.
   *
   * @param ws WebSocket connection for client.
   * @param message parsed incoming message object.
   */
  handleMessage(ws: ServerWebSocket, message: IncomingMessage): void {
    try {
      const parsed = formatIncoming(message);
      const handler = this.handlers.get(parsed.type);
      if (handler) {
        handler(ws, parsed);
      } else {
        const messageType = parsed?.type || 'unknown';
        this.logger.warn({ messageType }, `Unknown message type received: ${messageType}`);
        this.sendError(ws, 'Unknown message type');
      }
    } catch (error) {
      if (error instanceof Error) {
        const messageType = (message as { type?: string })?.type || 'unknown';
        this.logger.error({ messageType, error }, `Error handling message: ${messageType}`);
        this.sendError(ws, `Failed to process ${messageType}`);
      } else {
        this.logger.error('Unknown error type in handleMessage');
        this.sendError(ws, 'Unknown error');
      }
    }
  }

  /**
   * Handle session join request from client by creating or joining session as needed.
   *
   * @param ws WebSocket connection for client.
   * @param message session join message.
   */
  private handleSessionJoin(ws: ServerWebSocket, message: IncomingMessage): void {
    if (message.type !== 'session_join') return;
    const { sessionId, session: update, timer, user } = message;

    const now = Date.now();

    ws.socketId = generateUUID();
    ws.sessionId = sessionId as string;
    ws.clientId = formatClientId(user.clientId) as string;

    let session = this.getSession(ws.sessionId);
    const isNew = !session;

    if (!session) {
      session = this.createSession(ws.sessionId, update, timer);
    }

    const existing = session.users[ws.clientId];
    session.timer = session.timerCore.sync();

    if (existing) {
      const sockets = existing.sockets;
      sockets.set(ws.socketId, ws);

      Object.assign(
        existing,
        formatInternalUser({
          ...user,
          offlineAt: null,
          lastPing: now,
          sockets,
        })
      );

      this.logger.info(
        { clientId: ws.clientId, sessionId: ws.sessionId },
        `Client ${ws.clientId} reconnected to session ${ws.sessionId}`
      );

      const hasOnline = Object.values(session.users).some((u) =>
        Array.from(u.sockets.values()).some((socket) => socket.readyState === 1)
      );

      if (hasOnline && session.emptyAt) {
        session.emptyAt = null;
        this.logger.info({ sessionId }, `Session ${sessionId} no longer marked for cleanup`);
      }
    } else {
      const hashedId = hashString(ws.clientId);

      session.users[ws.clientId] = formatInternalUser({
        clientId: hashedId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isOnline: true,
        offlineAt: null,
        lastPing: now,
        sockets: new Map([[ws.socketId, ws]]),
      });

      this.logger.info(
        { clientId: ws.clientId, sessionId: ws.sessionId },
        `Client ${ws.clientId} joined session ${ws.sessionId}`
      );
    }

    this.setSession(session.sessionId, session);

    this.sendMessage(
      ws,
      isNew
        ? formatSessionCreatedMsg({
            sessionId: ws.sessionId,
            clientId: ws.clientId,
          })
        : formatSessionJoinedMsg({
            sessionId: ws.sessionId,
            clientId: ws.clientId,
            session,
          })
    );
    this.broadcastToSession(
      session,
      formatUserConnectedMsg({
        sessionId: session.sessionId,
        user: session.users[ws.clientId],
      }),
      ws.socketId,
      ws.clientId
    );
  }

  /**
   * Handle session update request by updating session intervals and broadcasting changes.
   *
   * @param ws WebSocket connection for client.
   * @param message session update message.
   */
  private handleSessionUpdate(ws: ServerWebSocket, message: IncomingMessage): void {
    if (message.type !== 'session_update') return;
    const { session: update, timer } = message;

    const session = this.getSocketSession(ws);
    if (!session) return;

    if (!Array.isArray(update.intervals?.items)) {
      return this.sendError(ws, 'Invalid intervals data');
    }

    session.name = update.name;
    session.description = update.description;
    session.intervals = update.intervals;
    session.timerCore.updateIntervals(session.intervals.items);
    session.timer = timer ? session.timerCore.updateState(timer) : session.timerCore.sync();

    this.setSession(session.sessionId, session);

    this.broadcastToSession(session, formatSessionUpdatedMsg(session), ws.socketId);
    this.broadcastTimerUpdate(session, ws.socketId);

    this.logger.debug({ sessionId: ws.sessionId }, `Session ${ws.sessionId} updated by client ${ws.clientId}`);
  }

  /**
   * Handle timer update from client by synchronizing timer state and broadcasting update.
   *
   * @param ws WebSocket connection for client.
   * @param message timer update message containing timer state.
   */
  private handleTimerUpdate(ws: ServerWebSocket, message: IncomingMessage): void {
    if (message.type !== 'timer_update') return;
    const { timer } = message;

    const session = this.getSocketSession(ws);
    if (!session) return;

    session.timer = session.timerCore.updateState(timer);

    this.setSession(session.sessionId, session);

    this.broadcastTimerUpdate(session, ws.socketId);

    this.logger.debug(
      { clientId: ws.clientId, sessionId: ws.sessionId },
      `Timer state updated from client ${ws.clientId} in session ${ws.sessionId}`
    );
  }

  /**
   * Handle user update request by updating user profile information and broadcasting change.
   *
   * @param ws WebSocket connection for client.
   * @param message user update message containing updated user data.
   */
  private handleUserUpdate(ws: ServerWebSocket, message: IncomingMessage): void {
    if (message.type !== 'user_update') return;
    const { user } = message;

    const clientId = ws.clientId as string;
    if (!clientId) return;

    const session = this.getSocketSession(ws);
    if (!session || !session.users[clientId]) return;

    const existing = session.users[clientId];

    existing.name = user.name;
    existing.avatarUrl = user.avatarUrl;

    session.users[clientId] = existing;

    this.setSession(session.sessionId, session);

    this.broadcastToSession(
      session,
      formatUserUpdatedMsg({
        sessionId: session.sessionId,
        user: existing,
      }),
      ws.socketId
    );

    this.logger.debug(
      { clientId: ws.clientId, sessionId: ws.sessionId },
      `User ${ws.clientId} updated profile in session ${ws.sessionId}`
    );
  }

  /**
   * Handle request to get list of connected users in session.
   *
   * @param ws WebSocket connection for client.
   * @param message user list message.
   */
  private handleUserList(ws: ServerWebSocket, message: IncomingMessage): void {
    if (message.type !== 'user_list') return;

    const session = this.getSocketSession(ws);
    if (!session) return;

    this.sendMessage(ws, formatUsersConnectedMsg(session));

    this.logger.debug(
      { clientId: ws.clientId, sessionId: ws.sessionId },
      `Connected users list sent to client ${ws.clientId} in session ${ws.sessionId}`
    );
  }

  /**
   * Create new session with given session ID.
   *
   * @param sessionId unique session ID.
   * @param update session update containing initial session data.
   * @param timer initial timer state for session.
   * @returns newly created session object.
   */
  private createSession(sessionId: string, update: SessionUpdate, timer: TimerState): SessionInternal {
    const session = formatInternalSession({
      sessionId,
      ...update,
    });

    session.timerCore.updateIntervals(session.intervals.items);
    session.timer = session.timerCore.updateState(timer);

    this.setSession(session.sessionId, session);

    return session;
  }

  /**
   * Set session object for given session ID.
   *
   * @param sessionId unique session ID.
   * @param session session object to store.
   */
  private setSession(sessionId: string, session: SessionInternal): void {
    if (!sessionId) return;
    this.sessions.set(sessionId, formatInternalSession(session));
  }

  /**
   * Retrieve session object for given session ID.
   *
   * @param sessionId unique session ID.
   * @returns session object if found, otherwise null.
   */
  getSession(sessionId: string): SessionInternal | null {
    return this.sessions.has(sessionId) ? this.sessions.get(sessionId)! : null;
  }

  /**
   * Retrieve session associated with given WebSocket client.
   *
   * @param ws WebSocket connection for client.
   * @returns session object if found, otherwise null.
   */
  private getSocketSession(ws: ServerWebSocket): SessionInternal | null {
    const session = this.getSession(ws.sessionId as string);

    if (!session) {
      this.sendError(ws, 'Session not found');
      return null;
    }

    session.lastActivity = Date.now();
    this.setSession(session.sessionId, session);

    return session;
  }

  /**
   * Start periodic cleanup timer for inactive sessions and offline users.
   */
  private startCleanup(): void {
    this.cleanup = setInterval(() => {
      this.cleanupSessions();
      this.cleanupOfflineUsers();
    }, CLEANUP_INTERVAL);
  }

  /**
   * Clean up sessions that have been inactive for configured timeout period.
   */
  private cleanupSessions(): void {
    const now = Date.now();
    let count = 0;

    this.sessions.forEach((session, sessionId) => {
      const online = Object.values(session.users).filter((u) =>
        Array.from(u.sockets.values()).some((ws) => ws.readyState === 1)
      ).length;

      if (online === 0 && session.emptyAt && now - session.emptyAt > SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        count++;
      }
    });

    if (count > 0) this.logger.info({ count }, `Cleaned up ${count} inactive sessions`);
  }

  /**
   * Track users who have gone offline based on their WebSocket state.
   */
  private trackOfflineUsers(): void {
    const now = Date.now();

    this.sessions.forEach((session: SessionInternal) => {
      Object.values(session.users).forEach((user: UserInternal) => {
        const isOnline = Array.from(user.sockets.values()).some((ws) => ws.readyState === 1);
        if (!isOnline && !user.offlineAt) {
          user.offlineAt = now;
        } else if (isOnline && user.offlineAt) {
          user.offlineAt = null;
        }
      });
    });
  }

  /**
   * Clean up users who have been offline for longer than configured timeout.
   */
  private cleanupOfflineUsers(): void {
    this.trackOfflineUsers();

    const now = Date.now();

    this.sessions.forEach((session: SessionInternal, sessionId: string) => {
      const remove: string[] = [];

      Object.entries(session.users).forEach(([clientId, user]) => {
        if (user.offlineAt && now - user.offlineAt > CLEANUP_INTERVAL) {
          remove.push(clientId);
        }
      });

      remove.forEach((clientId: string) => {
        const user = session.users[clientId];
        delete session.users[clientId];

        this.logger.info(
          { clientId, sessionId },
          `Removed offline user ${clientId} from session ${sessionId} after timeout`
        );

        this.broadcastToSession(
          session,
          formatUserDisconnectedMsg({
            sessionId,
            user,
          }),
          null,
          clientId
        );
      });

      if (Object.keys(session.users).length === 0 && !session.emptyAt) {
        session.emptyAt = Date.now();
        this.logger.info({ sessionId }, `Session ${sessionId} marked for cleanup`);
      }
    });
  }

  /**
   * Mark client as offline in session and schedule removal after timeout if not reconnected.
   *
   * @param ws WebSocket connection for client to remove.
   */
  removeClient(ws: ServerWebSocket): void {
    if (!ws.socketId || !ws.sessionId || !ws.clientId) return;

    const session = this.getSession(ws.sessionId);
    if (!session) return;

    const user = session.users[ws.clientId];
    if (!user) return;

    user.sockets.delete(ws.socketId);

    if (user.sockets.size > 0) return;

    user.offlineAt = Date.now();

    this.broadcastToSession(
      session,
      formatUserUpdatedMsg({
        sessionId: session.sessionId,
        user,
      }),
      ws.socketId,
      ws.clientId
    );

    this.logger.info(
      { clientId: ws.clientId, sessionId: ws.sessionId },
      `Client ${ws.clientId} disconnected from session ${ws.sessionId}`
    );

    const hasOnline = Object.values(session.users).some((u) =>
      Array.from(u.sockets.values()).some((ws) => ws.readyState === 1)
    );

    if (!hasOnline && !session.emptyAt) {
      session.emptyAt = Date.now();
      this.logger.info({ sessionId: ws.sessionId }, `Session ${ws.sessionId} marked for cleanup`);
    }
  }

  /**
   * Broadcast current timer state to all clients in session, excluding specified client if provided.
   *
   * @param session session object whose timer state will be broadcast.
   * @param exclude optional client ID to exclude from broadcast.
   */
  private broadcastTimerUpdate(session: SessionInternal, exclude: string | null | undefined = null): void {
    session.timer = session.timerCore.sync();
    this.broadcastToSession(session, formatTimerUpdatedMsg(session), exclude);
  }

  /**
   * Broadcast message to all clients in session, excluding specified client if provided.
   *
   * @param session session object whose clients will receive message.
   * @param message message to broadcast.
   * @param exclude optional client ID to exclude from broadcast.
   */
  private broadcastToSession(
    session: SessionInternal,
    message: OutgoingMessage,
    exclude: string | null | undefined = null,
    ignore: string | null | undefined = null
  ): void {
    Object.entries(session.users).forEach(([clientId, user]) => {
      if (ignore && ignore === clientId) return;
      user.sockets.forEach((ws) => {
        if (exclude && exclude === ws.socketId) return;
        this.sendMessage(ws, message);
      });
    });
  }

  /**
   * Send message to specific WebSocket client.
   *
   * @param ws WebSocket connection for client.
   * @param message message to send.
   */
  private sendMessage(ws: ServerWebSocket, message: OutgoingMessage | ErrorMessage): void {
    if (ws.readyState !== 1) return;

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error({ error }, `Error sending WebSocket message: ${error}`);
    }
  }

  /**
   * Send error message to specific WebSocket client.
   *
   * @param ws WebSocket connection for client.
   * @param message error message to send.
   */
  private sendError(ws: ServerWebSocket, message: string): void {
    const error = { message } as ErrorMessage;
    this.sendMessage(ws, formatErrorMsg(error));
  }

  /**
   * Dispose session manager by clearing all sessions, handlers, sockets, and cleanup intervals.
   */
  dispose(): void {
    if (this.cleanup) {
      clearInterval(this.cleanup);
      this.cleanup = null;
    }
    this.handlers.clear();
    this.sessions.clear();
    this.sockets.clear();
  }
}

export default SessionManager;
