import Utils, { DOM, Events } from './utils.js';

/**
 * User manager class for handling user profile data and UI interactions.
 */
class UserManager {
  /**
   * Create a UserManager instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.$userProfileBtn = DOM.getId('user-profile-btn');
    this.$userAvatar = DOM.getId('user-avatar');
    this.$avatarLarge = DOM.getId('user-avatar-large');
    this.$userNameInput = DOM.getId('user-name-input');
    this.$userEmailInput = DOM.getId('user-email-input');

    this._initialize();
  }

  /**
   * Set up user profile management and render initial UI.
   */
  _initialize() {
    this._listeners();
  }

  /**
   * Configure event listeners for user profile controls.
   */
  _listeners() {
    Events.on(this.$userProfileBtn, 'click', this.show.bind(this));

    Events.on(this.$userNameInput, 'blur', this.save.bind(this));
    Events.on(this.$userNameInput, 'keypress', (e) => {
      if (e.key === 'Enter') e.target.blur();
    });

    Events.on(this.$userEmailInput, 'blur', this.save.bind(this));
    Events.on(this.$userEmailInput, 'keypress', (e) => {
      if (e.key === 'Enter') e.target.blur();
    });

    Events.on(document, 'appRestarted', this.render.bind(this));

    Events.on(document, 'session_created', this.render.bind(this));
    Events.on(document, 'session_joined', this.render.bind(this));
    Events.on(document, 'user_connected', this.render.bind(this));
    Events.on(document, 'user_disconnected', this.render.bind(this));
    Events.on(document, 'user_updated', this.render.bind(this));
  }

  /**
   * Get user display name with fallback to email or 'Anonymous'.
   * @returns {string} The display name for the user.
   */
  displayName() {
    const current = this.app.getCurrentUser();
    return current.name || current.email || 'Anonymous';
  }

  /**
   * Update user profile button with name and avatar.
   */
  async renderButton() {
    const current = this.app.getCurrentUser();

    this.$userProfileBtn.title = this.displayName();
    this.$userAvatar.src = await Utils.getGravatarUrl(
      current.avatarUrl || current.email || Utils.getSHA256(current.clientId),
      80
    );
  }

  /**
   * Populate user profile modal with current data.
   */
  async renderModal() {
    const current = this.app.getCurrentUser();

    this.$userNameInput.value = current.name;
    this.$userEmailInput.value = current.email;
    this.$avatarLarge.src = await Utils.getGravatarUrl(
      current.avatarUrl || current.email || Utils.getSHA256(current.clientId),
      160
    );
  }

  /**
   * Update all user interface elements with current data.
   */
  async render() {
    await this.renderButton();
    await this.renderModal();
  }

  /**
   * Persist user profile changes and update avatar.
   */
  async save() {
    const session = this.app.getCurrentSession();
    const current = this.app.getCurrentUser();

    const newName = this.$userNameInput.value.trim();
    const newEmail = this.$userEmailInput.value.trim();

    if (newName === current.name && newEmail === current.email) return;

    current.name = newName;
    current.email = newEmail;
    current.avatarUrl = await Utils.getGravatarUrl(newEmail || Utils.getSHA256(current.clientId));

    this.app.setConnectedUser(current);
    this.app.saveCurrentSession();
    this.app.socket.userUpdate(session);

    await this.render();
  }

  /**
   * Display user profile editing modal.
   */
  async show() {
    await this.renderModal();
    DOM.showModal('user-modal');
  }
}

export default UserManager;
