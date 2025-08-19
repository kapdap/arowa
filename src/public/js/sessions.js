import Utils, { DOM, Events, Storage } from './utils.js';

/**
 * Session manager class for handling session and user management.
 */
class SessionManager {
  /**
   * Create a SessionManager instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.$sessionsBtn = DOM.getId('sessions-btn');
    this.$sessionName = DOM.getId('session-name');
    this.$sessionDesc = DOM.getId('session-description');
    this.$statusBar = DOM.query('.status-bar');
    this.$connectedUsers = DOM.getId('connected-users');
    this.$usersPopup = DOM.getId('users-popup');
    this.$usersList = DOM.getId('users-list');
    this.$sessionsPopup = DOM.getId('sessions-popup');
    this.$sessionList = DOM.getId('sessions-list');
    this.$clearBtn = DOM.getId('clear-all-sessions-btn');

    this._initialize();
  }

  /**
   * Initialize session manager and set up event listeners.
   */
  _initialize() {
    this._listeners();
  }

  /**
   * Configure event listeners for session UI interactions.
   */
  _listeners() {
    Events.on(this.$sessionsBtn, 'click', this.showSessions.bind(this));
    Events.on(this.$connectedUsers, 'click', this.showUsers.bind(this));
    Events.on(this.$statusBar, 'click', this._fetchUsersList.bind(this));

    const $popupCloseBtns = DOM.queryAll('.close-popup-btn');
    $popupCloseBtns.forEach(($btn) => {
      Events.on($btn, 'click', (e) => {
        const $popup = e.target.closest('.popup');
        if ($popup) DOM.hidePopup($popup.id);
      });
    });

    Events.on(document, 'click', (e) => {
      Events.on(this.$clearBtn, 'click', this._clear.bind(this));

      if (
        this.$usersPopup &&
        !this.$usersPopup.classList.contains('hidden') &&
        !this.$usersPopup.contains(e.target) &&
        e.target !== this.$connectedUsers &&
        !this.$connectedUsers?.contains(e.target)
      ) {
        DOM.hidePopup('users-popup');
      }

      if (
        this.$sessionsPopup &&
        !this.$sessionsPopup.classList.contains('hidden') &&
        !this.$sessionsPopup.contains(e.target) &&
        e.target !== this.$sessionsBtn &&
        !this.$sessionsBtn?.contains(e.target)
      ) {
        DOM.hidePopup('sessions-popup');
      }
    });

    Events.on(document, 'click', (e) => {
      if (e.target.classList.contains('close')) {
        const $modal = e.target.closest('.modal');
        if ($modal) DOM.hideModal($modal.id);
        return;
      }

      if (e.target.classList.contains('modal')) {
        DOM.hideModal(e.target.id);
        return;
      }
    });

    Events.on(document, 'appRestarted', this.render.bind(this));

    Events.on(document, 'session_created', this.render.bind(this));
    Events.on(document, 'session_joined', this.render.bind(this));
    Events.on(document, 'user_connected', this.render.bind(this));
    Events.on(document, 'user_disconnected', this.render.bind(this));
    Events.on(document, 'user_updated', this.render.bind(this));
    Events.on(document, 'users_connected', this.render.bind(this));
  }

  /**
   * Request updated connected users list from server.
   */
  _fetchUsersList() {
    this.app.socket.usersList();
  }

  /**
   * Create a connected user item element for the users popup.
   * @param {Object} user - User object.
   * @returns {HTMLElement} User item element.
   */
  _createUserEl(user) {
    const status = user.isOnline ? 'online' : 'offline';

    const $item = DOM.create('div', { className: 'user-item' });
    const $info = DOM.create('div', { className: 'user-item-info' });
    const $avatar = DOM.create('div', { className: 'user-item-avatar' });

    const $image = DOM.create('img', {
      src: Utils.getGravatarUrl(user.avatarUrl || user.clientId, 40),
      alt: user.name || 'User avatar',
      className: `user-status-${status}`,
    });

    const $name = DOM.create(
      'div',
      {
        className: 'user-item-name',
      },
      user.name || 'Anonymous User'
    );

    $avatar.appendChild($image);
    $info.appendChild($name);

    $item.appendChild($avatar);
    $item.appendChild($info);

    return $item;
  }

  /**
   * Create a session list item element for the sessions popup.
   * @param {Object} session - Session data object.
   * @returns {HTMLElement} Session item element.
   */
  _createSessionEl(session) {
    const sessionId = session.sessionId;

    const $sessionItem = DOM.create('div', {
      className: `session-item ${sessionId === this.app.getCurrentSessionId() ? 'current' : ''}`,
      'data-session-id': sessionId,
    });

    const $sessionInfo = DOM.create('div', { className: 'session-item-info' });
    const $sessionName = DOM.create(
      'div',
      {
        className: 'session-item-name',
      },
      session.name || sessionId
    );

    const $sessionIdSpan = DOM.create(
      'div',
      {
        className: 'session-item-id',
      },
      sessionId
    );

    const $sessionDescription = DOM.create(
      'div',
      {
        className: 'session-item-description',
      },
      session.description
    );

    const $checkbox = DOM.create('input', {
      type: 'checkbox',
      className: 'session-checkbox',
    });

    const $deleteBtn = DOM.create(
      'button',
      {
        className: 'session-delete-btn btn-danger btn-small',
      },
      '✖'
    );

    const $sessionDetails = DOM.create('div', { className: 'session-item-details' });
    const $sessionActions = DOM.create('div', { className: 'session-item-actions' });

    $sessionInfo.appendChild($sessionName);
    $sessionInfo.appendChild($sessionDetails);

    $sessionDetails.appendChild($sessionDescription);
    if (session.name) $sessionDetails.appendChild($sessionIdSpan);

    $sessionActions.appendChild($checkbox);
    $sessionActions.appendChild($deleteBtn);

    $sessionItem.appendChild($sessionInfo);
    $sessionItem.appendChild($sessionActions);

    Events.on($sessionInfo, 'click', () => {
      if (sessionId === this.app.getCurrentSessionId()) return;
      const url = `${window.location.origin}/${sessionId}`;
      window.open(url, '_blank');
    });

    Events.on($checkbox, 'change', this.renderClearButton.bind(this));
    Events.on($deleteBtn, 'click', (e) => {
      e.stopPropagation();
      this._remove(sessionId);
    });

    return $sessionItem;
  }

  /**
   * Clear all sessions or delete selected sessions if any are checked.
   */
  async _clear() {
    const $checkboxes = DOM.queryAll('.session-checkbox:checked');
    if ($checkboxes.length > 0) {
      this._removeSelected();
      return;
    }

    const confirmed = await Utils.showConfirm('Delete all sessions? This cannot be undone.');
    if (!confirmed) return;

    Storage.clearAllSessions();

    this.app.restart();
    this.renderSessions();
  }

  /**
   * Delete a specific session by ID.
   * @param {string} sessionId - Session ID to delete.
   */
  async _remove(sessionId) {
    const confirmed = await Utils.showConfirm(`Delete session "${sessionId}"?`);
    if (!confirmed) return;

    Storage.deleteSession(sessionId);

    if (sessionId === this.app.getCurrentSessionId()) {
      this.app.restart();
    }

    this.renderSessions();
  }

  /**
   * Delete all selected sessions from storage.
   */
  async _removeSelected() {
    const $checkboxes = DOM.queryAll('.session-checkbox:checked');
    const sessionIds = Array.from($checkboxes).map(($cb) =>
      $cb.closest('.session-item').getAttribute('data-session-id')
    );
    if (sessionIds.length === 0) return;

    const confirmed = await Utils.showConfirm(`Delete ${sessionIds.length} selected session(s)?`);
    if (!confirmed) return;

    let isCurrent = false;

    sessionIds.forEach((sessionId) => {
      Storage.deleteSession(sessionId);
      if (isCurrent) return;
      isCurrent = sessionId === this.app.getCurrentSessionId();
    });

    if (isCurrent) {
      this.app.restart();
    }

    this.renderSessions();
  }

  /**
   * Check if WebSocket is connected, otherwise wait for connection to join session.
   * @param {Object} session
   * @param {Object} user
   */
  _waitSocket(session, user) {
    const handler = () => {
      this.app.socket.sessionJoin(session, user);
    };

    if (this.app.socket.isConnected()) {
      handler();
      return;
    }

    Events.on(document, 'websocketConnected', handler, { once: true });
  }

  /**
   * Load session from URL parameter or create new session.
   */
  loadFromUrl() {
    const sessionId = Utils.getSessionIdFromUrl();

    if (sessionId) {
      this.join(sessionId);
    } else {
      this.create();
    }
  }

  /**
   * Create a new session with a random ID.
   */
  create() {
    this.join(Utils.generateSessionId());
  }

  /**
   * Connect to session and initialize user state.
   * @param {string} sessionId - Session ID to join.
   */
  join(sessionId) {
    if (!Utils.isValidSessionId(sessionId)) {
      console.log('Sanitizing invalid session ID:', sessionId);
      sessionId = Utils.generateSessionId(sessionId);
    }

    const session = Storage.loadSession(sessionId);
    const user = session.user?.clientId ? session.user : this.app.getCurrentUser();

    this.app.setCurrentSession(session);
    this.app.setConnectedUser(user);
    this.app.timer.reload(true);

    this._waitSocket(session, user);

    this.render();
  }

  /**
   * Display session name and description in header.
   */
  renderDescription() {
    const session = this.app.getCurrentSession();
    this.$sessionName.textContent = session?.name || '';
    this.$sessionDesc.textContent = session?.description || '';
  }

  /**
   * Update connected users count display.
   */
  renderUserCount() {
    const count = this.app.getConnectedUserCount();
    this.$connectedUsers.textContent = `${count} user${count === 1 ? '' : 's'} connected`;
  }

  /**
   * Render the list of connected users in the popup.
   */
  renderUsers() {
    this.$usersList.innerHTML = '';

    if (this.app.getConnectedUserCount() === 0) {
      this.$usersList.innerHTML = '<p class="empty-state">No users currently connected</p>';
      return;
    }

    const users = this.app.getConnectedUsers();
    const $userItems = Object.values(users).map((user) => this._createUserEl(user));

    $userItems.forEach(($item) => this.$usersList.appendChild($item));
  }

  /**
   * Render the list of sessions in the popup.
   */
  renderSessions() {
    const sessions = Storage.getSessionData();
    if (sessions && Object.keys(sessions).length === 0) {
      this.$sessionList.innerHTML = '<p class="empty-state">No sessions found</p>';
      this.$clearBtn.style.display = 'none';
      return;
    }

    this.$sessionList.innerHTML = '';
    this.$clearBtn.style.display = 'block';

    Object.values(sessions).forEach((session) => {
      const $item = this._createSessionEl(session);
      this.$sessionList.appendChild($item);
    });

    this.renderClearButton();
  }

  /**
   * Update the clear button text based on selected session items.
   */
  renderClearButton() {
    const $checkboxes = DOM.queryAll('.session-checkbox:checked');
    if ($checkboxes.length > 0) {
      this.$clearBtn.textContent = `Delete Selected Sessions (${$checkboxes.length})`;
    } else {
      this.$clearBtn.textContent = 'Clear All Sessions';
    }
  }

  /**
   * Update all session UI elements with current data.
   */
  render() {
    this.renderDescription();
    this.renderUserCount();
    this.renderUsers();
    this.renderSessions();
  }

  /**
   * Display sessions popup with saved sessions list.
   */
  showSessions() {
    this.renderSessions();
    DOM.showPopup('sessions-popup');
  }

  /**
   * Display connected users popup with current user list.
   */
  showUsers() {
    this.renderUsers();
    DOM.showPopup('users-popup');
  }
}

export default SessionManager;
