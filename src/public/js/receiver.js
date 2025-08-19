import Utils, { Events, Storage } from './utils.js';

/**
 * Receive SocketClient messages and update the session state in response.
 */
class Receiver {
  /**
   * Create a Receiver instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;
    this.handlers = new Map();
    this._initialize();
  }

  /**
   * Set up event coordination system.
   */
  _initialize() {
    this._handlers();
    this._listeners();
  }

  /**
   * Register message handlers for WebSocket message types.
   */
  _handlers() {
    this.handlers.set('session_created', this._sessionCreated.bind(this));
    this.handlers.set('session_joined', this._sessionJoined.bind(this));
    this.handlers.set('session_updated', this._sessionUpdated.bind(this));
    this.handlers.set('timer_updated', this._timerUpdated.bind(this));
    this.handlers.set('user_connected', this._userConnected.bind(this));
    this.handlers.set('user_disconnected', this._userDisconnected.bind(this));
    this.handlers.set('user_updated', this._userUpdated.bind(this));
    this.handlers.set('users_connected', this._usersConnected.bind(this));
  }

  /**
   * Register listener for WebSocket messages dispatched from the SocketClient.
   */
  _listeners() {
    Events.on(document, 'websocketMessage', this._process.bind(this));
  }

  /**
   * Process WebSocket messages and dispatch application updates.
   * @param {Object} event - Event object dispatched from the SocketClient.
   */
  async _process(event) {
    const { detail: data } = event;

    if (!data?.sessionId) {
      console.error('Session ID missing from websocket message:', data);
      return;
    }

    const handler = this.handlers.get(data.type);
    if (!handler) {
      console.error('No receiver handler for message type:', data.type);
      return;
    }

    try {
      const session =
        this.app.getCurrentSessionId() === data.sessionId
          ? this.app.getCurrentSession()
          : Storage.loadSession(data.sessionId);

      await handler(data, session);

      Events.dispatch(document, 'receivedMessage', { data, session });
    } catch (error) {
      console.error('Error processing message handler:', error);
    }
  }

  /**
   * Handle session created message by initializing or updating session data with client information.
   * @param {Object} data - Session creation data containing sessionId and clientId.
   * @param {Object} session - Session object to update.
   */
  _sessionCreated(data, session) {
    session.sessionId = data.sessionId;
    this._updateUser(data, session);
  }

  /**
   * Handle session joined message by merging session data and updating user information.
   * @param {Object} data - Session join data containing sessionId, session object, and clientId.
   * @param {Object} session - Session object to update.
   */
  _sessionJoined(data, session) {
    Object.assign(session, data.session);
    if (session.user.clientId !== data.clientId) {
      this._updateUser(data, session);
    }
  }

  /**
   * Handle session updated message by merging new session data into existing session.
   * @param {Object} data - Session update data containing sessionId and session object.
   * @param {Object} session - Session object to update.
   */
  _sessionUpdated(data, session) {
    Object.assign(session, data.session);
  }

  /**
   * Handle timer updated message by merging new timer data into existing session timer.
   * @param {Object} data - Timer update data containing sessionId and timer object.
   * @param {Object} session - Session object to update.
   */
  _timerUpdated(data, session) {
    Object.assign(session.timer, data.timer);
  }

  /**
   * Handle user connected message.
   */
  _userConnected() {}

  /**
   * Handle user disconnected message.
   */
  _userDisconnected() {}

  /**
   * Handle user updated message.
   */
  _userUpdated() {}

  /**
   * Handle users connected message.
   */
  _usersConnected() {}

  /**
   * Update user information in session.
   * @param {Object} data - User data.
   * @param {Object} session - Session object.
   */
  _updateUser(data, session) {
    session.user.clientId = data.clientId;
    session.user.hashedId = Utils.getSHA256(data.clientId);
    session.user.avatarUrl = Utils.getGravatarUrl(session.user.email || session.user.hashedId);
  }
}

export default Receiver;
