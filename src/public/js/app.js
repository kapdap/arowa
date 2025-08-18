import Utils, { DOM, Events, Storage } from './utils.js';
import SocketClient from './socket.js';
import Receiver from './receiver.js';
import AlertSystem from './alerts.js';
import SessionManager from './sessions.js';
import IntervalsManager from './intervals.js';
import SettingsManager from './settings.js';
import ShareManager from './share.js';
import UserManager from './user.js';
import Timer from './timer.js';

/**
 * Timer application class.
 */
class TimerApp {
  /**
   * Create a TimerApp instance and initialize the application state and components.
   */
  constructor() {
    this.isInitialized = false;
    this.handlers = new Map();

    this.socket = null;
    this.receiver = null;
    this.alerts = null;
    this.sessions = null;
    this.intervals = null;
    this.settings = null;
    this.share = null;
    this.user = null;
    this.timer = null;

    this.currentSessionId = null;
    this.currentSession = null;
    this.connectedUsers = null;
    this.currentUser = {
      hashedId: '',
      clientId: '',
      name: '',
      email: '',
      avatarUrl: '',
    };

    this.$statusEl = DOM.getId('connection-status');

    this._initialize();
  }

  /**
   * Initialize application components and event handlers.
   */
  _initialize() {
    if (this.isInitialized) return;

    console.log('Initializing Timer App...');

    if (document.readyState === 'loading') {
      console.log('Waiting for DOMContentLoaded to initialize app...');
      Events.on(document, 'DOMContentLoaded', this._initializeApp.bind(this));
    } else {
      console.log('DOMContentLoaded already fired, initializing app...');
      this._initializeApp();
    }
  }

  /**
   * Complete application setup and start the timer app.
   */
  _initializeApp() {
    try {
      this._components();
      this._handlers();
      this._listeners();
      this._shortcuts();
      this._visibility();
      this.connect();

      this.sessions.loadFromUrl();

      this.isInitialized = true;
      console.log('Timer App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }

  /**
   * Create instances of all application components.
   */
  _components() {
    this.socket = new SocketClient(this);
    this.receiver = new Receiver(this);
    this.alerts = new AlertSystem(this);
    this.sessions = new SessionManager(this);
    this.intervals = new IntervalsManager(this);
    this.settings = new SettingsManager(this);
    this.share = new ShareManager(this);
    this.user = new UserManager(this);
    this.timer = new Timer(this);
  }

  /**
   * Register message handlers for Receiver messages.
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
   * Configure global event listeners for window events.
   */
  _listeners() {
    Events.on(window, 'beforeunload', this._beforeUnload.bind(this));
    Events.on(window, 'focus', this._windowFocus.bind(this));
    Events.on(document, 'receivedMessage', this._process.bind(this));
    Events.on(this.$statusEl, 'click', this.connect.bind(this));
  }

  /**
   * Configure keyboard shortcuts for application controls.
   */
  _shortcuts() {
    Events.on(document, 'keydown', (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle shortcuts
      switch (event.key) {
        case ' ': // Spacebar - Start/Pause timer
          event.preventDefault();
          this.timer?.toggleTimer();
          break;

        case 'ArrowRight': // Right arrow - Next interval
          event.preventDefault();
          this.timer?.next();
          break;

        case 's': // S - Show settings
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.settings?.show();
          }
          break;

        case 'i': // I - Show intervals
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.intervals?.show();
          }
          break;

        case 'u': // U - Show user profile
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.user?.show();
          }
          break;

        case 'p': // P - Show users list
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.sessions?.showUsers();
          }
          break;

        case 'l': // L - Show sessions list
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.sessions?.showSessions();
          }
          break;

        case 'Escape': // Escape - Close modals
          DOM.hideAllModals();
          break;
      }
    });
  }

  /**
   * Setup page visibility event handling for timer and socket reconnect.
   */
  _visibility() {
    let eventName = 'visibilitychange';

    if (typeof document.hidden === 'undefined') {
      if (typeof document.webkitHidden !== 'undefined') {
        eventName = 'webkitvisibilitychange';
      } else if (typeof document.mozHidden !== 'undefined') {
        eventName = 'mozvisibilitychange';
      } else if (typeof document.msHidden !== 'undefined') {
        eventName = 'msvisibilitychange';
      }
    }

    Events.on(document, eventName, () => {
      if (document.hidden) return;
      this._pageVisible();
    });
  }

  /**
   * Update timer display when window regains focus.
   */
  _windowFocus() {
    this.timer.tickTimer();
  }

  /**
   * Reconnect WebSocket when page becomes visible.
   */
  _pageVisible() {
    this.connect();
  }

  /**
   * Clean up resources before page unload.
   */
  _beforeUnload() {
    this.dispose();
  }

  /**
   * Establish WebSocket connection to the server if not already connected.
   */
  connect() {
    if (!this.socket.isConnected()) this.socket.reconnect();
  }

  /**
   * Clear the current session data.
   */
  clearCurrentSession() {
    this.currentSession = null;
    this.currentSessionId = null;
  }

  /**
   * Persist current session to local storage.
   */
  saveCurrentSession() {
    if (!this.currentSession) return;
    Storage.saveSession(this.currentSession);
  }

  /**
   * Update current session and initialize user data.
   * @param {Object} session - Session object to set as current.
   */
  async setCurrentSession(session) {
    this.currentSession = session;
    this.currentSessionId = session.sessionId;
    Utils.setSessionIdInUrl(session.sessionId);
    await this.setCurrentUser(session.user);
  }

  /**
   * Get the current session data.
   * @returns {Object|null} Current session object or null.
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get the current session ID.
   * @returns {string|null} Current session ID or null.
   */
  getCurrentSessionId() {
    if (!this.currentSessionId) {
      const session = this.getCurrentSession();
      this.currentSessionId = session ? session.sessionId : null;
    }
    return this.currentSessionId;
  }

  /**
   * Process and store user data with generated avatar.
   * @param {Object} user - User object containing user data.
   */
  async setCurrentUser(user) {
    const clientId = Utils.isValidClientId(user?.clientId) ? user.clientId : Utils.generateClientId();
    const hashedId = Utils.getSHA256(clientId);
    const current = {
      hashedId,
      clientId,
      name: String(user?.name ?? ''),
      email: String(user?.email ?? ''),
      avatarUrl: await Utils.getGravatarUrl(user?.avatarUrl || user?.email || hashedId),
    };
    this.currentUser = current;

    if (!this.currentSession) return;
    this.currentSession.user = current;
  }

  /**
   * Get the current user data.
   * @returns {Object} Current user object.
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Reset current user to default empty state.
   */
  clearCurrentUser() {
    this.currentUser = {
      hashedId: '',
      clientId: '',
      name: '',
      email: '',
      avatarUrl: '',
    };
  }

  /**
   * Clear all connected users from the map.
   */
  clearConnectedUsers() {
    this.connectedUsers = null;
  }

  /**
   * Get the map of connected users.
   * @returns {Object|null} Map of connected users or null.
   */
  getConnectedUsers() {
    return this.connectedUsers;
  }

  /**
   * Set the map of connected users.
   * @param {Object} users - Map of connected users.
   */
  setConnectedUsers(users) {
    this.connectedUsers = users;
  }

  /**
   * Set a connected user in the map.
   * @param {Object} user - User object to add to connected users.
   */
  setConnectedUser(user) {
    const connected = { ...user };
    if (!connected?.clientId) return;

    if (connected?.hashedId) {
      connected.clientId = connected.hashedId;
    }

    if (!this.connectedUsers) {
      this.connectedUsers = {};
    }

    this.connectedUsers[connected.clientId] = {
      clientId: connected.clientId,
      name: connected.name,
      avatarUrl: connected.avatarUrl,
      isOnline: connected.isOnline,
    };
  }

  /**
   * Delete a connected user from the map.
   * @param {Object|string} user - User object with clientId property or client ID string.
   */
  deleteConnectedUser(user) {
    const clientId = typeof user === 'string' ? user : user.clientId;
    if (!this.connectedUsers || !clientId) return;
    delete this.connectedUsers[clientId];
    if (this.getConnectedUserCount() === 0) this.clearConnectedUsers();
  }

  /**
   * Get the number of connected users.
   * @returns {number} Number of connected users.
   */
  getConnectedUserCount() {
    return this.connectedUsers ? Object.keys(this.connectedUsers).length : 0;
  }

  /**
   * Process messages from the Receiver and update application state.
   * @param {Object} event - Event object containing message details.
   */
  async _process(event) {
    const { data, session } = event.detail;

    const handler = this.handlers.get(data.type);
    if (!handler) {
      console.warn('No handler for message type:', data.type);
      return;
    }

    try {
      await this.setCurrentSession(session);
      await handler(data, session);
      this.saveCurrentSession();

      Events.dispatch(document, data.type, { data, session });
    } catch (error) {
      console.error('Error processing message handler:', error);
    }
  }

  /**
   * Handle session created event by clearing connected users and setting current user.
   * @param {Object} data - Event data.
   * @param {Object} session - Session object.
   */
  async _sessionCreated(data, session) {
    this.clearConnectedUsers();
    this.setConnectedUser(session.user);
    this.setCurrentUser(session.user);
    this.timer.reload();
  }

  /**
   * Handle session joined event by setting connected users and reloading timer.
   * @param {Object} data - Event data.
   * @param {Object} session - Session object.
   */
  async _sessionJoined(data, session) {
    if (Object.keys(session.users).length > 0) {
      this.setConnectedUsers(session.users);
    } else {
      this.clearConnectedUsers();
      this.setConnectedUser(session.user);
    }

    this.setCurrentUser(session.user);
    this.timer.reload();
  }

  /**
   * Handle session updated event by updating timer intervals.
   */
  async _sessionUpdated() {
    this.timer.updateIntervals();
  }

  /**
   * Handle timer updated event by updating timer state.
   */
  async _timerUpdated() {
    this.timer.update();
  }

  /**
   * Handle user connected event by adding user to connected users map.
   * @param {Object} data - Event data.
   */
  _userConnected(data) {
    this.setConnectedUser(data.user);
  }

  /**
   * Handle user updated event by updating user in connected users map.
   * @param {Object} data - Event data.
   */
  _userUpdated(data) {
    this.setConnectedUser(data.user);
  }

  /**
   * Handle user disconnected event by removing user from connected users map.
   * @param {Object} data - Event data.
   */
  _userDisconnected(data) {
    this.deleteConnectedUser(data.user);
  }

  /**
   * Handle users connected event by setting all connected users.
   * @param {Object} data - Event data.
   */
  _usersConnected(data) {
    this.setConnectedUsers(data.users);
  }

  /**
   * Restart the application and create a new session.
   */
  async restart() {
    console.log('Restarting application...');
    this.socket.disconnect();

    this.clearCurrentSession();
    this.clearConnectedUsers();
    this.clearCurrentUser();

    this.socket.connect();

    await this.sessions.create();

    this.timer.reload(true);

    console.log('Application restarted');
    Events.dispatch(document, 'appRestarted');
  }

  /**
   * Dispose of all components that have a dispose method.
   */
  dispose() {
    Object.entries(this).forEach(([name, component]) => {
      if (component && typeof component.dispose === 'function') {
        try {
          console.log(`Disposing component: ${name}`);
          component.dispose();
        } catch (error) {
          console.warn(`Error disposing component ${name}:`, error);
        }
      }
    });
  }
}

window.app = new TimerApp();

export default TimerApp;
