import type { ServerWebSocket } from './server';
import type TimerCore from '../shared/timer-core';

export interface User {
  clientId: string;
  name: string;
  avatarUrl: string;
  isOnline: boolean;
}

export interface UserInternal extends User {
  lastPing?: number;
  offlineAt?: number | null;
  ws?: ServerWebSocket | null;
}

export interface UserUpdated {
  sessionId: string;
  user: UserInternal;
}

export interface UserList {
  [key: string]: User;
}

export interface UserListInternal {
  [key: string]: UserInternal;
}

export interface TimerState {
  repeat: boolean;
  interval: number;
  remaining: number;
  isRunning: boolean;
  isPaused: boolean;
}

export interface TimerStateInternal extends TimerState {
  startedAt?: number;
  startedInterval?: number;
  pausedAt?: number;
  timePaused?: number;
}

export interface Interval {
  name: string;
  duration: number;
  alert: string;
  customCSS: string;
}

export interface IntervalList {
  lastUpdated: number;
  items: Interval[];
}

export interface SessionUpdate {
  name: string;
  description: string;
  intervals: IntervalList;
}

export interface SessionNew {
  sessionId: string;
}

export interface Session extends SessionNew, SessionUpdate {
  timer: TimerState;
  users: UserList;
}

export interface SessionInternal extends Session {
  timerCore: TimerCore;
  users: UserListInternal;
  createdAt: number;
  lastActivity: number;
  emptyAt: number | null;
}

export interface SessionCreated extends SessionNew {
  clientId: string;
}

export interface SessionJoined extends SessionCreated {
  session: SessionInternal;
}

export interface WebSocketMessage {
  type: string;
}

export interface SessionJoinMessage extends WebSocketMessage {
  type: 'session_join';
  sessionId: string;
  session: SessionUpdate;
  timer: TimerState;
  user: User;
}

export interface SessionUpdateMessage extends WebSocketMessage {
  type: 'session_update';
  session: SessionUpdate;
  timer?: TimerState;
}

export interface TimerUpdateMessage extends WebSocketMessage {
  type: 'timer_update';
  timer: TimerState;
}

export interface UserUpdateMessage extends WebSocketMessage {
  type: 'user_update';
  user: User;
}

export interface UserListMessage extends WebSocketMessage {
  type: 'user_list';
}

export interface PingMessage extends WebSocketMessage {
  type: 'ping';
}

export interface UnknownIncomingMessage extends WebSocketMessage {
  type: 'unknown';
  originalType: unknown;
  data: unknown;
}

export type IncomingMessage =
  | SessionJoinMessage
  | SessionUpdateMessage
  | TimerUpdateMessage
  | UserUpdateMessage
  | UserListMessage
  | PingMessage;

export interface SessionCreatedMessage extends WebSocketMessage {
  type: 'session_created';
  sessionId: string;
  clientId: string;
}

export interface SessionJoinedMessage extends WebSocketMessage {
  type: 'session_joined';
  sessionId: string;
  clientId: string;
  session: Session;
}

export interface SessionUpdatedMessage extends WebSocketMessage {
  type: 'session_updated';
  sessionId: string;
  session: SessionUpdate;
}

export interface TimerUpdatedMessage extends WebSocketMessage {
  type: 'timer_updated';
  sessionId: string;
  timer: TimerState;
}

export interface UserConnectedMessage extends WebSocketMessage {
  type: 'user_connected';
  sessionId: string;
  user: User;
}

export interface UserDisconnectedMessage extends WebSocketMessage {
  type: 'user_disconnected';
  sessionId: string;
  user: User;
}

export interface UserUpdatedMessage extends WebSocketMessage {
  type: 'user_updated';
  sessionId: string;
  user: User;
}

export interface UsersConnectedMessage extends WebSocketMessage {
  type: 'users_connected';
  sessionId: string;
  users: UserList;
}

export interface PongMessage extends WebSocketMessage {
  type: 'pong';
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  message: string | number | object | null;
}

export type OutgoingMessage =
  | SessionCreatedMessage
  | SessionJoinedMessage
  | SessionUpdatedMessage
  | TimerUpdatedMessage
  | UserConnectedMessage
  | UserDisconnectedMessage
  | UserUpdatedMessage
  | UsersConnectedMessage
  | PongMessage
  | ErrorMessage;
