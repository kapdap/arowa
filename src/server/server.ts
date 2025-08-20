/**
 * Express + WebSocket server for collaborative timer.
 */

import type { ErrorMessage, Session } from '../types/messages';
import type { ServerWebSocket } from '../types/server';
import type { Logger } from 'pino';
import { createLogger } from './logger.js';
import { formatSession, formatPongMsg, formatErrorMsg } from './messages.js';
import SessionManager from './sessions.js';
import express, { Express, Request, Response, NextFunction } from 'express';
import http, { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';
import dotenv from '@dotenvx/dotenvx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const SOCKET_TIMEOUT = 30000;
const SHUTDOWN_TIMEOUT = 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const environments = ['production', 'development'];
if (!environments.includes(process.env.NODE_ENV || '')) {
  process.env.NODE_ENV = 'production';
}

/**
 * Main server class for handling HTTP and WebSocket connections.
 */
class TimerServer {
  logger: Logger;
  express: Express;
  server: HttpServer;
  host: string;
  port: number;
  wss: WebSocketServer | null;
  wsPort: number | string;
  sessions: SessionManager;

  /**
   * Initialize server, configure Express middleware, and set up WebSocket server.
   */
  constructor() {
    this.logger = createLogger('timer-server');
    this.express = express();
    this.server = http.createServer(this.express);
    this.host = process.env.HOST || 'localhost';
    this.port = Number(process.env.PORT) || 3000;
    this.wss = null;
    this.wsPort = Number(process.env.WS_PORT) || this.port;
    this.sessions = new SessionManager();

    this.logger.info({ environment: process.env.NODE_ENV }, `Starting server in ${process.env.NODE_ENV} mode`);

    this.setupExpress();
    this.setupWebSocket();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware, static file serving, security headers, and request logging.
   */
  setupExpress(): void {
    this.express.set('trust proxy', 1);

    this.express.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    if (process.env.NODE_ENV === 'development') {
      this.express.use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        this.logger.debug({ method: req.method, url: req.url }, `HTTP request: ${req.method} ${req.url}`);
        next();
      });
    }

    this.express.use(express.json({ limit: '10mb' }));
    this.express.use(express.urlencoded({ extended: true, limit: '10mb' }));

    this.express.use(
      express.static(path.join(__dirname, '../public'), {
        maxAge: '1h',
        etag: true,
      })
    );

    if (process.env.BUILD !== 'dist') {
      // Serve shared files in development mode for client access
      this.express.use(
        '/js/shared',
        express.static(path.join(__dirname, '../shared'), {
          maxAge: '1h',
          etag: true,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
          },
        })
      );
    }

    this.express.use((req: Request, _res: Response, next: NextFunction) => {
      this.logger.debug({ method: req.method, url: req.url }, `HTTP request: ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Initialize WebSocket server with connection handlers and periodic client health checks.
   */
  setupWebSocket(): void {
    this.wss = new WebSocketServer({
      server: this.server,
      clientTracking: true,
      perMessageDeflate: false,
    });

    this.wss.on('connection', (ws: ServerWebSocket) => {
      this.handleWebSocketConnection(ws);
    });

    this.wss.on('error', (error: Error) => {
      this.logger.error({ error }, `WebSocket server error: ${error?.message || 'Unknown error'}`);
    });

    setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws: ServerWebSocket) => {
        if (ws.isAlive === false) {
          this.logger.debug('Terminating dead WebSocket connection');
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, SOCKET_TIMEOUT);
  }

  /**
   * Define HTTP routes for session API and main application.
   */
  setupRoutes(): void {
    this.express.get('/api/session/:sessionId', (req: Request, res: Response, next: NextFunction) => {
      const { sessionId } = req.params;
      const session = this.sessions.getSession(sessionId);
      if (!session) return next();
      res.json(formatSession(session) as Session);
    });

    this.express.get('/:sessionId?', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  /**
   * Register Express error middleware and process-level handlers for graceful shutdown.
   */
  setupErrorHandling(): void {
    this.express.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
      this.logger.error({ error }, `Express error: ${error?.message || 'Unknown error'}`);

      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error?.message || 'Unknown error' : 'Something went wrong',
      });
    });

    process.on('uncaughtException', (error: Error) => {
      this.logger.fatal({ error }, `Uncaught Exception: ${error?.message || 'Unknown error'}`);
      this.stop('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      this.logger.fatal({ reason, promise }, `Unhandled Rejection: ${reason}`);
      this.stop('UNHANDLED_REJECTION');
    });

    process.on('SIGTERM', () => {
      this.logger.trace('SIGTERM received');
      this.stop('SIGTERM');
    });

    process.on('SIGINT', () => {
      this.logger.trace('SIGINT received');
      this.stop('SIGINT');
    });
  }

  /**
   * Initialize WebSocket connection with event handlers and client tracking.
   *
   * @param ws WebSocket connection instance for client.
   */
  handleWebSocketConnection(ws: ServerWebSocket): void {
    this.logger.info({}, `WebSocket connection established`);

    ws.isAlive = true;
    ws.socketId = null;
    ws.sessionId = null;
    ws.clientId = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message: WebSocket.RawData) => {
      this.handleWebSocketMessage(ws, message);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleWebSocketClose(ws, code, reason.toString());
    });

    ws.on('error', (error: Error) => {
      this.logger.error({ error }, `WebSocket error: ${error?.message || 'Unknown error'}`);
    });
  }

  /**
   * Parse and process incoming WebSocket messages from clients.
   *
   * @param ws WebSocket connection instance for client.
   * @param message raw message data received from client.
   */
  handleWebSocketMessage(ws: ServerWebSocket, message: WebSocket.RawData): void {
    try {
      const data = JSON.parse(message.toString());

      if (!data.type) {
        throw new Error('Message without type received');
      }

      if (data.type === 'ping') {
        ws.send(JSON.stringify(formatPongMsg()));
        return;
      }

      this.sessions.handleMessage(ws, data);
    } catch (error) {
      this.logger.error({ error }, `Error parsing WebSocket message: ${error || 'Unknown error'}`);
      this.sendError(ws, 'Invalid message format');
    }
  }

  /**
   * Clean up client session data when WebSocket connection closes.
   *
   * @param ws WebSocket connection instance for client.
   * @param code WebSocket close code.
   * @param reason reason for connection closure.
   */
  handleWebSocketClose(ws: ServerWebSocket, code: number, reason: string): void {
    this.logger.info(
      { code, reason },
      `WebSocket connection closed with code ${code}: ${reason || 'No reason provided'}`
    );

    this.sessions.removeClient(ws);
  }

  /**
   * Send formatted error message to WebSocket client if connection is open.
   *
   * @param ws WebSocket connection instance for client.
   * @param message error message to send to client.
   */
  sendError(ws: ServerWebSocket, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      const error = { message } as ErrorMessage;
      ws.send(JSON.stringify(formatErrorMsg(error)));
    }
  }

  /**
   * Start HTTP server and begin listening for connections on configured port.
   */
  start(): void {
    this.server.listen(this.port, () => {
      const webUrl = `http://${this.host}:${this.port}`;
      const websocketUrl = `ws://${this.host}:${this.port}`;
      this.logger.info({ webUrl, websocketUrl }, `Web server listening at ${webUrl}`);
    });

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        this.logger.fatal({ port: this.port }, `Port ${this.port} already in use`);
        process.exit(1);
      } else {
        this.logger.error({ error }, `Server error: ${error?.message || 'Unknown error'}`);
      }
    });
  }

  /**
   * Initiate graceful shutdown of HTTP server and WebSocket connections.
   *
   * @param signal name of signal that triggered shutdown.
   */
  stop(signal: string): void {
    this.logger.info({ signal }, `Graceful shutdown initiated`);

    if (this.wss) {
      this.logger.debug('Closing WebSocket server...');
      this.wss.close(() => {
        this.logger.debug('WebSocket server closed');
      });
    }

    this.server.close(() => {
      this.logger.info('Server shutdown successful');
      process.exit(0);
    });

    setTimeout(() => {
      this.logger.error('Unable to close connections gracefully... initiating forceful shutdown');
      this.logger.info('Server shutdown successful');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
  }
}

const server = new TimerServer();
server.start();

export default TimerServer;
