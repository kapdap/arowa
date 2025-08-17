import { DOM, Events } from './utils.js';

/**
 * WebSocket client manager.
 */
class SocketClient {
  /**
   * Create a new WebSocketClient instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.ws = null;
    this.isConnecting = false;
    this.hasConnection = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;

    this.$avatarLarge = DOM.getId('user-avatar-large');
    this.$statusElement = DOM.getId('user-profile-btn');
    this.$statusText = DOM.getId('connection-status');

    this.statusText = 'connected';
    this.statuses = {
      connected: 'Connected',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting...',
      disconnected: 'Disconnected',
      error: 'Connection failed',
    };

    this._initialize();
  }

  /**
   * Set up WebSocket client configuration and handlers.
   */
  _initialize() {
    this.render();
  }

  /**
   * Set up event handlers for the WebSocket instance.
   */
  _listeners() {
    this.ws.onopen = () => {
      this.hasConnection = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.statusText = 'connected';
      this.render();
      this._startHeartbeat();

      console.log('WebSocket connected');
      Events.dispatch(document, 'websocketConnected');
    };

    this.ws.onclose = (event) => {
      this._disconnected(event);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this._connectionError();
    };

    this.ws.onmessage = (event) => {
      this._process(event);
    };
  }

  /**
   * Handle WebSocket disconnection event.
   * @param {CloseEvent} event - The close event from the WebSocket.
   */
  _disconnected(event) {
    this.hasConnection = false;
    this.isConnecting = false;
    this._stopHeartbeat();

    console.log('WebSocket disconnected:', event.code, event.reason);
    Events.dispatch(document, 'websocketDisconnected');

    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this._scheduleReconnect();
    } else {
      this.statusText = 'disconnected';
      this.render();
    }
  }

  /**
   * Process connection errors and attempt reconnection.
   */
  _connectionError() {
    this.isConnecting = false;
    this.statusText = 'error';
    this.render();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this._scheduleReconnect();
    }
  }

  /**
   * Queue reconnection attempt with increasing delay.
   */
  _scheduleReconnect() {
    this.reconnectAttempts++;
    this.statusText = 'reconnecting';
    this.render();

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (!this.hasConnection) {
        console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect();
      }
    }, delay);
  }

  /**
   * Begin periodic ping messages to maintain connection.
   */
  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.hasConnection) {
        this.send({
          type: 'ping',
        });

        this.heartbeatTimeout = setTimeout(() => {
          console.warn('Heartbeat timeout, closing connection');
          this.ws.close();
        }, 5000);
      }
    }, 30000);
  }

  /**
   * Stop the heartbeat interval and timeout.
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Parse and process incoming WebSocket messages.
   * @param {MessageEvent} event - The message event containing data from the server.
   */
  _process(event) {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'pong') {
        if (this.heartbeatTimeout) {
          clearTimeout(this.heartbeatTimeout);
          this.heartbeatTimeout = null;
        }
        return;
      }

      Events.dispatch(document, 'websocketMessage', message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Get the current WebSocket connection state.
   * @returns {boolean} True if the WebSocket is connected, otherwise false.
   */
  isConnected() {
    return this.hasConnection;
  }

  /**
   * Establish WebSocket connection to server.
   */
  connect() {
    if (this.hasConnection || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.statusText = 'connecting';
    this.render();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? 443 : 80);
    const wsUrl = `${protocol}//${host}:${port === '80' || port === '443' ? '' : port}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this._listeners();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this._connectionError();
    }
  }

  /**
   * Close WebSocket connection and clean up resources.
   */
  disconnect() {
    this._stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.hasConnection = false;
    this.isConnecting = false;
    this.statusText = 'disconnected';
    this.render();
  }

  /**
   * Reconnect to the WebSocket server.
   */
  reconnect() {
    this.reconnectAttempts = 0;
    this.disconnect();
    this.connect();
  }

  /**
   * Send a message to the WebSocket server.
   * @param {Object} message - The message object to send.
   */
  send(message) {
    if (this.hasConnection && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
  }

  /**
   * Request to join session with user data.
   * @param {Object} session - The session object containing intervals and timer data.
   * @param {Object} user - The user data to send.
   */
  sessionJoin(session, user) {
    const intervals = session?.intervals || { lastUpdated: 0, items: [] };
    const timer = session?.timer;

    this.send({
      type: 'session_join',
      sessionId: session.sessionId,
      session: {
        name: String(session?.name ?? ''),
        description: String(session?.description ?? ''),
        intervals,
      },
      timer: {
        repeat: timer?.repeat ?? false,
        interval: timer?.interval ?? 0,
        remaining: timer?.remaining ?? 0,
        isRunning: timer?.isRunning ?? false,
        isPaused: timer?.isPaused ?? false,
      },
      user: {
        clientId: user?.clientId || '',
        name: user?.name || '',
        avatarUrl: user?.avatarUrl || '',
      },
    });
  }

  /**
   * Send session intervals update to server.
   * @param {Object} session - The session object containing intervals and timer data.
   * @param {boolean} [updateTimer=false] - Whether to include timer state in the update.
   */
  sessionUpdate(session, updateTimer = false) {
    const intervals = session?.intervals || { lastUpdated: 0, items: [] };
    const timer = session?.timer;

    this.send({
      type: 'session_update',
      session: {
        name: String(session?.name ?? ''),
        description: String(session?.description ?? ''),
        intervals,
      },
      ...(updateTimer
        ? {
            timer: {
              repeat: timer?.repeat ?? false,
              interval: timer?.interval ?? 0,
              remaining: timer?.remaining ?? 0,
              isRunning: timer?.isRunning ?? false,
              isPaused: timer?.isPaused ?? false,
            },
          }
        : {}),
    });
  }

  /**
   * Send an updated timer state for a session to the server.
   * @param {Object} session - The session object containing timer data.
   */
  timerUpdate(session) {
    const timer = session?.timer;

    this.send({
      type: 'timer_update',
      timer: {
        repeat: timer?.repeat ?? false,
        interval: timer?.interval ?? 0,
        remaining: timer?.remaining ?? 0,
        isRunning: timer?.isRunning ?? false,
        isPaused: timer?.isPaused ?? false,
      },
    });
  }

  /**
   * Update the user profile for a session.
   * @param {Object} session - The session object containing user data.
   */
  userUpdate(session) {
    const user = session?.user;

    this.send({
      type: 'user_update',
      user: {
        clientId: user?.clientId,
        name: user?.name,
        avatarUrl: user?.avatarUrl,
      },
    });
  }

  /**
   * Request the list of connected users from the server.
   */
  usersList() {
    this.send({
      type: 'user_list',
    });
  }

  /**
   * Render the connection status in the UI.
   */
  render() {
    const statuses = Object.keys(this.statuses);

    this.$avatarLarge.classList.remove(...statuses);
    this.$statusElement.classList.remove(...statuses);
    this.$statusText.classList.remove(...statuses);

    if (this.statuses[this.statusText]) {
      this.$avatarLarge.classList.add(this.statusText);
      this.$statusElement.classList.add(this.statusText);
      this.$statusText.classList.add(this.statusText);
    }

    if (this.statusText === 'reconnecting') {
      this.$statusText.textContent = `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
    } else {
      this.$statusText.textContent = this.statuses[this.statusText] || '';
    }

    if (this.statusText === 'connected') {
      this.$statusText.style.display = 'none';
    } else {
      this.$statusText.style.display = 'inline';
    }
  }
}

export default SocketClient;
