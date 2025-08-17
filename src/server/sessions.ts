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
  SessionJoinMessage,
  SessionUpdate,
  SessionUpdateMessage,
  SessionUpdatedMessage,
  TimerState,
  TimerUpdateMessage,
  UserInternal,
  UserUpdated,
  UserUpdateMessage,
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
} from './messages.js';
import { createLogger } from './logger.js';

const CLEANUP_INTERVAL = Number(process.env.CLEANUP_INTERVAL) || 300000;
const SESSION_TIMEOUT = 10 * 60 * 1000;

/**
 * Session manager class for handling real-time collaboration.
 */
class SessionManager {
  private logger: Logger;
  private sessions: Map<string, SessionInternal>;
  private handlers: Map<string, (ws: ServerWebSocket, message: IncomingMessage) => void>;
  private cleanup: NodeJS.Timeout | null;

  /**
   * Initialize session manager, set up message handlers, and start cleanup timer.
   */
  constructor() {
    this.logger = createLogger('session-manager');
    this.sessions = new Map();
    this.handlers = new Map();
    this.cleanup = null;

    this.setupHandlers();
    this.startCleanupTimer();
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
      const parsed = formatIncoming(message) as IncomingMessage;
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
    const { sessionId, session: update, timer, user } = message as SessionJoinMessage;

    ws.sessionId = sessionId as string;
    ws.clientId = formatClientId(user.clientId) as string;

    let session = this.getSession(ws.sessionId);
    const isNew = !session;

    if (!session) session = this.createSession(ws.sessionId, update, timer);
    session.timer = session.timerCore.sync();

    const now = Date.now();
    const clientId = ws.clientId;
    const existing = session.users[clientId];

    if (existing) {
      Object.assign(
        existing,
        formatInternalUser({
          ...user,
          clientId: existing.clientId,
          offlineAt: null,
          lastPing: now,
          ws,
        })
      );
      session.users[clientId] = existing;
      this.logger.info(
        { clientId: ws.clientId, sessionId: ws.sessionId },
        `Client ${ws.clientId} reconnected to session ${ws.sessionId}`
      );

      const hasOffline = Object.values(session.users).some((u) => !u.ws || u.ws.readyState !== 1);
      if (!hasOffline && session.emptyAt) {
        session.emptyAt = null;
        this.logger.info({ sessionId }, `Session ${sessionId} no longer marked for cleanup`);
      }
    } else {
      const hashedId = hashString(clientId);
      session.users[clientId] = formatInternalUser({
        clientId: hashedId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        isOnline: true,
        offlineAt: null,
        lastPing: now,
        ws,
      });
      this.logger.info(
        { clientId: ws.clientId, sessionId: ws.sessionId },
        `Client ${ws.clientId} joined session ${ws.sessionId}`
      );
    }

    this.setSession(ws.sessionId, session);
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
        user: session.users[clientId],
      }),
      clientId
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
    const { session: update, timer } = message as SessionUpdateMessage;

    const session = this.getClientSession(ws);
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
    this.broadcastToSession(session, formatSessionUpdatedMsg(session) as SessionUpdatedMessage, ws.clientId);
    this.broadcastTimerUpdate(session, ws.clientId);

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
    const { timer } = message as TimerUpdateMessage;

    const session = this.getClientSession(ws);
    if (!session) return;

    session.timer = session.timerCore.updateState(timer);

    this.setSession(session.sessionId, session);
    this.broadcastTimerUpdate(session, ws.clientId);

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
    const { user } = message as UserUpdateMessage;

    const clientId = ws.clientId as string;
    if (!clientId) return;

    const session = this.getClientSession(ws);
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
      } as UserUpdated),
      clientId
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

    const session = this.getClientSession(ws);
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
    if (!sessionId) return null;
    return this.sessions.has(sessionId) ? this.sessions.get(sessionId)! : null;
  }

  /**
   * Retrieve session associated with given WebSocket client.
   *
   * @param ws WebSocket connection for client.
   * @returns session object if found, otherwise null.
   */
  private getClientSession(ws: ServerWebSocket): SessionInternal | null {
    if (ws.sessionId && this.sessions.has(ws.sessionId)) {
      const session = this.getSession(ws.sessionId);
      if (!session) return null;

      session.lastActivity = Date.now();
      this.setSession(session.sessionId, session);

      return session;
    }

    this.sendError(ws, 'Session not found');

    return null;
  }

  /**
   * Start periodic cleanup timer for inactive sessions and offline users.
   */
  private startCleanupTimer(): void {
    this.cleanup = setInterval(() => {
      this.cleanupInactiveSessions();
      this.cleanupOfflineUsers();
    }, CLEANUP_INTERVAL);
  }

  /**
   * Clean up sessions that have been inactive for configured timeout period.
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    let count = 0;

    this.sessions.forEach((session, sessionId) => {
      const online = Object.values(session.users).filter((u) => u.ws?.readyState === 1).length;

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
        const isOnline = user.ws?.readyState === 1;
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
          })
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
   * @param sessionId session ID from which to remove client.
   * @param clientId client ID to mark as offline.
   */
  removeClient(sessionId: string, clientId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    const user = session.users[clientId];
    if (user) {
      user.offlineAt = Date.now();
      user.ws = null;

      this.broadcastToSession(
        session,
        formatUserUpdatedMsg({
          sessionId,
          user,
        }),
        clientId
      );

      this.logger.info({ clientId, sessionId }, `Client ${clientId} disconnected from session ${sessionId}`);

      const hasOnline = Object.values(session.users).some((u) => u.ws?.readyState === 1);
      if (!hasOnline && !session.emptyAt) {
        session.emptyAt = Date.now();
        this.logger.info({ sessionId }, `Session ${sessionId} marked for cleanup`);
      }

      session.users[clientId] = user;
      this.setSession(sessionId, session);
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
    exclude: string | null | undefined = null
  ): void {
    Object.entries(session.users).forEach(([clientId, user]) => {
      if (clientId !== exclude && user.ws?.readyState === 1) {
        this.sendMessage(user.ws, message);
      }
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
   * Dispose session manager by clearing all sessions, handlers, and cleanup intervals.
   */
  dispose(): void {
    if (this.cleanup) {
      clearInterval(this.cleanup);
      this.cleanup = null;
    }
    this.sessions.clear();
    this.handlers.clear();
  }
}

export default SessionManager;
