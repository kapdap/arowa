/**
 * Handle websocket messages, formatting and data sanitization.
 */

import type {
  ErrorMessage,
  IncomingMessage,
  Interval,
  IntervalList,
  PingMessage,
  PongMessage,
  Session,
  SessionCreated,
  SessionCreatedMessage,
  SessionInternal,
  SessionJoined,
  SessionJoinedMessage,
  SessionJoinMessage,
  SessionNew,
  SessionUpdate,
  SessionUpdatedMessage,
  SessionUpdateMessage,
  TimerState,
  TimerStateInternal,
  TimerUpdatedMessage,
  TimerUpdateMessage,
  UnknownIncomingMessage,
  User,
  UserConnectedMessage,
  UserDisconnectedMessage,
  UserInternal,
  UserList,
  UserListInternal,
  UserListMessage,
  UsersConnectedMessage,
  UserUpdated,
  UserUpdatedMessage,
  UserUpdateMessage,
} from '../types/messages';
import {
  CLIENT_ID_REGEX,
  DEFAULT_DURATION,
  MAX_DURATION,
  MAX_NAME_LENGTH,
  MAX_STRING_LENGTH,
  MAX_URL_LENGTH,
  MIN_DURATION,
  SESSION_ID_REGEX,
} from '../shared/constants.js';
import TimerCore from '../shared/timer-core.js';
import crypto from 'crypto';

/**
 * Generate UUID v4 string.
 *
 * @returns randomly generated UUID v4 string.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hash string using SHA256.
 *
 * @param input string to hash.
 * @returns SHA256 hash of input string as hexadecimal string.
 */
export function hashString(input: string): string {
  return crypto
    .createHash('sha256')
    .update(input ?? '')
    .digest('hex');
}

// =============================================================================
// BASE FORMATTERS
// =============================================================================

/**
 * Format session ID string by trimming and validating against regex pattern.
 *
 * @param input session ID string to format.
 * @returns formatted session ID if valid, otherwise empty string.
 */
export function formatSessionId(input: string): string {
  const sessionId = (input || '').trim();
  return SESSION_ID_REGEX.test(sessionId) ? sessionId : '';
}

/**
 * Format client ID string by lowercasing, trimming and validating against regex pattern.
 *
 * @param input client ID string to format.
 * @returns formatted client ID if valid, otherwise new UUID.
 */
export function formatClientId(input: string): string {
  const clientId = (input || '').toLowerCase().trim();
  return CLIENT_ID_REGEX.test(clientId) ? clientId : generateUUID();
}

/**
 * Format user object for external use by trimming and validating fields.
 *
 * @param user user object to format (User or UserInternal).
 * @returns formatted User object with trimmed and validated fields.
 */
export function formatUser(user: User | UserInternal): User {
  return {
    clientId: user?.clientId || '',
    name: (user?.name || '').trim().substring(0, MAX_NAME_LENGTH),
    avatarUrl: (user?.avatarUrl || '').trim().substring(0, MAX_URL_LENGTH),
    isOnline: 'offlineAt' in user ? Boolean(!user.offlineAt) : true, // offlineAt is only on UserInternal
  };
}

/**
 * Format users list for external use by mapping values and keying by clientId.
 *
 * Note: External users are keyed by clientId.
 *
 * @param users users list to format (UserList or UserListInternal).
 * @returns formatted UserList keyed by clientId.
 */
export function formatUserList(users: UserList | UserListInternal): UserList {
  return Object.values(users || {}).reduce((acc, user) => {
    if (user?.clientId) {
      acc[user.clientId] = formatUser(user);
    }
    return acc;
  }, {} as UserList);
}

/**
 * Format interval object for external use by validating and sanitizing fields.
 *
 * @param interval interval object to format.
 * @returns formatted Interval object with validated and sanitized fields.
 */
export function formatInterval(interval: Interval): Interval {
  return {
    name: (interval?.name || '').trim().substring(0, MAX_NAME_LENGTH),
    duration: Math.max(MIN_DURATION, Math.min(MAX_DURATION, Number(interval?.duration || DEFAULT_DURATION))),
    alert: (interval?.alert || '').trim().substring(0, MAX_NAME_LENGTH) || 'Default',
    customCSS: (interval?.customCSS || '').trim(), // TODO: Sanitize CSS
  };
}

/**
 * Format intervals collection for external use by validating items array and lastUpdated timestamp.
 *
 * @param intervals intervals object to format.
 * @returns formatted IntervalList object with validated items.
 */
export function formatIntervalList(intervals: IntervalList): IntervalList {
  return {
    lastUpdated: Number(intervals?.lastUpdated ?? Date.now()),
    items: Array.isArray(intervals?.items) ? intervals.items.map(formatInterval) : [],
  };
}

/**
 * Format timer state object for external use by validating and sanitizing timer fields.
 *
 * @param timer timer state object to format.
 * @returns formatted TimerState object with validated and sanitized fields.
 */
export function formatTimer(timer: TimerState | TimerStateInternal): TimerState {
  return {
    repeat: Boolean(timer?.repeat ?? false),
    interval: Math.max(0, Math.min(timer?.interval || 0, Number.MAX_SAFE_INTEGER)),
    remaining: Math.max(0, Math.min(timer?.remaining || DEFAULT_DURATION * 1000, MAX_DURATION * 1000)),
    isRunning: Boolean(timer?.isRunning ?? false),
    isPaused: Boolean(timer?.isPaused ?? false),
  };
}

/**
 * Format session object for external use by validating all fields and formatting nested objects.
 *
 * @param session session object to format (Session or SessionInternal).
 * @returns formatted Session object with validated fields and formatted users.
 */
export function formatSession(session: Session | SessionInternal): Session {
  return {
    sessionId: formatSessionId(session?.sessionId || ''),
    name: (session?.name || '').trim().substring(0, MAX_STRING_LENGTH),
    description: (session?.description || '').trim().substring(0, MAX_STRING_LENGTH),
    intervals: formatIntervalList(session?.intervals || {}),
    timer: formatTimer(session?.timer || {}),
    users: formatUserList(session?.users || {}),
  };
}

/**
 * Format session update object for external use by validating and trimming fields.
 *
 * @param session session update object to format.
 * @returns formatted SessionUpdate object with validated fields.
 */
export function formatSessionUpdate(session: SessionUpdate): SessionUpdate {
  return {
    name: (session?.name || '').trim().substring(0, MAX_STRING_LENGTH),
    description: (session?.description || '').trim().substring(0, MAX_STRING_LENGTH),
    intervals: formatIntervalList(session?.intervals || {}),
  };
}

// =============================================================================
// INCOMING MESSAGE FORMATTERS
// =============================================================================

/**
 * Format session join message for processing by validating all nested objects.
 *
 * @param message session join message to format.
 * @returns formatted SessionJoinMessage with validated sessionId and user.
 */
export function formatSessionJoinMsg(message: SessionJoinMessage): SessionJoinMessage {
  return {
    type: 'session_join',
    sessionId: formatSessionId(message?.sessionId || ''),
    session: formatSessionUpdate(message?.session || {}),
    timer: formatTimer(message?.timer || {}),
    user: formatUser(message?.user || {}),
  };
}

/**
 * Format session update message for processing by validating session and optional timer fields.
 *
 * @param message session update message to format.
 * @returns formatted SessionUpdateMessage with validated session fields.
 */
export function formatSessionUpdateMsg(message: SessionUpdateMessage): SessionUpdateMessage {
  const session = message?.session;
  return {
    type: 'session_update',
    session: formatSessionUpdate(session || {}),
    ...(message?.timer
      ? {
          timer: formatTimer(message?.timer || ({} as TimerState)),
        }
      : {}),
  };
}

/**
 * Format timer update message for processing by validating timer object.
 *
 * @param message timer update message to format.
 * @returns formatted TimerUpdateMessage with formatted timer.
 */
export function formatTimerUpdateMsg(message: TimerUpdateMessage): TimerUpdateMessage {
  return {
    type: 'timer_update',
    timer: formatTimer(message?.timer || {}),
  };
}

/**
 * Format user update message for processing by validating user object.
 *
 * @param message user update message to format.
 * @returns formatted UserUpdateMessage with formatted user.
 */
export function formatUserUpdateMsg(message: UserUpdateMessage): UserUpdateMessage {
  return {
    type: 'user_update',
    user: formatUser(message?.user || {}),
  };
}

/**
 * Create user list message object.
 *
 * @returns UserListMessage object.
 */
export function formatUserListMsg(): UserListMessage {
  return { type: 'user_list' };
}

/**
 * Create ping message object.
 *
 * @returns PingMessage object.
 */
export function formatPingMsg(): PingMessage {
  return { type: 'ping' };
}

// =============================================================================
// OUTGOING MESSAGE FORMATTERS
// =============================================================================

/**
 * Format session created message for outgoing communication by validating IDs.
 *
 * @param message session created object to format.
 * @returns formatted SessionCreatedMessage with validated sessionId and clientId.
 */
export function formatSessionCreatedMsg(message: SessionCreated): SessionCreatedMessage {
  return {
    type: 'session_created',
    sessionId: formatSessionId(message?.sessionId || ''),
    clientId: formatClientId(message?.clientId || ''),
  };
}

/**
 * Format session joined message for outgoing communication by validating IDs and session object.
 *
 * @param message session joined object to format.
 * @returns formatted SessionJoinedMessage with validated sessionId, clientId, and session.
 */
export function formatSessionJoinedMsg(message: SessionJoined): SessionJoinedMessage {
  return {
    type: 'session_joined',
    sessionId: formatSessionId(message?.sessionId || ''),
    clientId: formatClientId(message?.clientId || ''),
    session: formatSession(message?.session || {}),
  };
}

/**
 * Format user connected message for outgoing communication by validating sessionId and user.
 *
 * @param message user updated object to format.
 * @returns formatted UserConnectedMessage with validated sessionId and user.
 */
export function formatUserConnectedMsg(message: UserUpdated): UserConnectedMessage {
  return {
    type: 'user_connected',
    sessionId: formatSessionId(message?.sessionId || ''),
    user: formatUser(message?.user || {}),
  };
}

/**
 * Format user disconnected message for outgoing communication by validating sessionId and user.
 *
 * @param message user updated object to format.
 * @returns formatted UserDisconnectedMessage with validated sessionId and user.
 */
export function formatUserDisconnectedMsg(message: UserUpdated): UserDisconnectedMessage {
  return {
    type: 'user_disconnected',
    sessionId: formatSessionId(message?.sessionId || ''),
    user: formatUser(message?.user || {}),
  };
}

/**
 * Format user updated message for outgoing communication by validating sessionId and user.
 *
 * @param message user updated object to format.
 * @returns formatted UserUpdatedMessage with validated sessionId and user.
 */
export function formatUserUpdatedMsg(message: UserUpdated): UserUpdatedMessage {
  return {
    type: 'user_updated',
    sessionId: formatSessionId(message.sessionId || ''),
    user: formatUser(message.user || {}),
  };
}

/**
 * Format connected users message for outgoing communication by extracting sessionId and users from session.
 *
 * @param session session object to format.
 * @returns formatted UsersConnectedMessage with validated sessionId and users.
 */
export function formatUsersConnectedMsg(session: SessionInternal): UsersConnectedMessage {
  return {
    type: 'users_connected',
    sessionId: formatSessionId(session.sessionId || ''),
    users: formatUserList(session?.users || {}),
  };
}

/**
 * Format session updated message for outgoing communication by extracting session fields.
 *
 * @param session session object to format.
 * @returns formatted SessionUpdatedMessage with validated sessionId and session fields.
 */
export function formatSessionUpdatedMsg(session: SessionInternal): SessionUpdatedMessage {
  return {
    type: 'session_updated',
    sessionId: formatSessionId(session?.sessionId || ''),
    session: {
      name: (session?.name || '').trim(),
      description: (session?.description || '').trim(),
      intervals: formatIntervalList(session?.intervals || {}),
    },
  };
}

/**
 * Format timer updated message for outgoing communication by extracting timer state from session.
 *
 * @param session session object to format.
 * @returns formatted TimerUpdatedMessage with validated sessionId and timer.
 */
export function formatTimerUpdatedMsg(session: SessionInternal): TimerUpdatedMessage {
  return {
    type: 'timer_updated',
    sessionId: formatSessionId(session?.sessionId || ''),
    timer: formatTimer(session?.timer || {}),
  };
}

/**
 * Create pong message object.
 *
 * @returns PongMessage object.
 */
export function formatPongMsg(): PongMessage {
  return { type: 'pong' };
}

/**
 * Format error message for outgoing communication by trimming and validating message text.
 *
 * @param error error message object to format.
 * @returns formatted ErrorMessage with trimmed message.
 */
export function formatErrorMsg(error: ErrorMessage): ErrorMessage {
  return {
    type: 'error',
    message: (typeof error.message === 'string' ? error.message.trim() : error?.message) || 'Unknown error',
  };
}

// =============================================================================
// INTERNAL STRUCTURE FORMATTERS
// =============================================================================

/**
 * Format user object for internal use by adding connection state fields.
 *
 * @param input user object to format as internal (User or UserInternal).
 * @returns formatted UserInternal object with connection state fields.
 */
export function formatInternalUser(input: User | UserInternal): UserInternal {
  const user = input as UserInternal;
  return {
    ...formatUser(user),

    // Internal connection state, these properties do not exist in User type
    lastPing: user?.lastPing || Date.now(),
    offlineAt: user?.offlineAt || 0,
    ws: user?.ws || null,
  };
}

/**
 * Format users list for internal use by adding connection state fields to each user.
 *
 * Note: Internal users are keyed by clientId, not hashedId.
 *
 * @param input users list to format as internal (UserList or UserListInternal).
 * @returns formatted UserListInternal object with connection state fields for each user.
 */
export function formatInternalUsers(input: UserList | UserListInternal): UserListInternal {
  const users = input as UserListInternal;
  return Object.entries(users || {}).reduce((acc, [key, user]) => {
    acc[key] = formatInternalUser(user);
    return acc;
  }, {} as UserListInternal);
}

/**
 * Format timer state object for internal use by adding timing state fields.
 *
 * @param input timer state object to format as internal (TimerState or TimerStateInternal).
 * @returns formatted TimerStateInternal object with timing state fields.
 */
export function formatInternalTimer(input: TimerState | TimerStateInternal): TimerStateInternal {
  const timer = input as TimerStateInternal;
  return {
    ...formatTimer(timer),

    // Internal timing state, these properties do not exist in TimerState type
    startedAt: timer?.startedAt || 0,
    startedInterval: timer?.startedInterval || 0,
    pausedAt: timer?.pausedAt || 0,
    timePaused: timer?.timePaused || 0,
  };
}

/**
 * Format session object for internal use by adding timer instance and activity fields.
 *
 * @param input session object to format as internal (Session, SessionInternal, or SessionNew).
 * @returns formatted SessionInternal object with timer instance and activity fields.
 */
export function formatInternalSession(input: Session | SessionInternal | SessionNew): SessionInternal {
  const session = input as SessionInternal;
  return {
    sessionId: formatSessionId(session?.sessionId || ''),
    name: (session?.name || '').trim().substring(0, MAX_STRING_LENGTH),
    description: (session?.description || '').trim().substring(0, MAX_STRING_LENGTH),
    intervals: formatIntervalList(session?.intervals || {}),
    timer: formatInternalTimer(session?.timer || {}),
    timerCore: session?.timerCore || new TimerCore(session?.intervals?.items || []),
    users: formatInternalUsers(session?.users || {}),
    createdAt: session?.createdAt || Date.now(),
    lastActivity: session?.lastActivity || Date.now(),
    emptyAt: session?.emptyAt || 0,
  };
}

// =============================================================================
// MAIN FORMATTER DISPATCHER
// =============================================================================

/**
 * Format incoming message with strict explicit typing by dispatching to appropriate formatter based on message type.
 *
 * @param data incoming message object to format.
 * @returns formatted IncomingMessage.
 * @throws Error if message type is unknown.
 */
export function formatIncoming(
  data:
    | SessionJoinMessage
    | SessionUpdateMessage
    | TimerUpdateMessage
    | UserListMessage
    | UserUpdateMessage
    | PingMessage
    | UnknownIncomingMessage
): IncomingMessage {
  switch (data.type) {
    case 'session_join':
      return formatSessionJoinMsg(data);
    case 'session_update':
      return formatSessionUpdateMsg(data);
    case 'timer_update':
      return formatTimerUpdateMsg(data);
    case 'user_list':
      return formatUserListMsg();
    case 'user_update':
      return formatUserUpdateMsg(data);
    case 'ping':
      return formatPingMsg();
    default:
      throw new Error('Invalid message type');
  }
}
