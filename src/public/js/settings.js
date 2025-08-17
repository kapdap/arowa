import Utils, { DOM, Events, Storage } from './utils.js';

/**
 * Settings manager class.
 */
class SettingsManager {
  /**
   * Create a new SettingsManager instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.isUpdating = false;
    this.noSleep = new NoSleep();

    this.$settingsBtn = DOM.getId('settings-btn');
    this.$sessionNameInput = DOM.getId('session-name-input');
    this.$sessionDescInput = DOM.getId('session-desc-input');
    this.$repeatToggle = DOM.getId('repeat-toggle');
    this.$focusModeToggle = DOM.getId('focus-mode-toggle');
    this.$audioToggle = DOM.getId('audio-toggle');
    this.$wakeLockToggle = DOM.getId('wake-lock-toggle');
    this.$focusModeBtn = DOM.getId('focus-mode-btn');
    this.$focusModeLine = DOM.getId('focus-mode-disabled-line');
    this.$wakeLockBtn = DOM.getId('wake-lock-btn');
    this.$wakeLockLine = DOM.getId('wake-lock-disabled-line');

    this._initialize();
  }

  /**
   * Initialize the settings manager by setting up event listeners and initializing focus mode.
   */
  _initialize() {
    this._listeners();
    this.loadFocusMode();
  }

  /**
   * Configure event listeners for settings UI controls.
   */
  _listeners() {
    Events.on(this.$settingsBtn, 'click', this.show.bind(this));

    Events.on(this.$sessionNameInput, 'blur', Utils.debounce(this.save.bind(this), 500));
    Events.on(this.$sessionDescInput, 'blur', Utils.debounce(this.save.bind(this), 500));

    Events.on(this.$repeatToggle, 'change', this.toggleRepeat.bind(this));
    Events.on(this.$focusModeToggle, 'change', this.toggleFocusMode.bind(this));
    Events.on(this.$audioToggle, 'change', this.toggleAudio.bind(this));
    Events.on(this.$wakeLockToggle, 'change', this.toggleWakeLock.bind(this));

    Events.on(this.$wakeLockBtn, 'click', this.toggleWakeLock.bind(this));
    Events.on(this.$focusModeBtn, 'click', this.toggleFocusMode.bind(this));

    Events.on(document, 'audioUnlocked', this.renderToggleStates.bind(this));
    Events.on(document, 'appRestarted', this.render.bind(this));

    Events.on(document, 'session_created', this.render.bind(this));
    Events.on(document, 'session_updated', this.render.bind(this));
    Events.on(document, 'timer_updated', this.render.bind(this));
  }

  /**
   * Begin monitoring user activity to auto-hide UI.
   */
  _startActivityTracking() {
    this.activityTimeout = null;
    this.isTrackingActivity = true;
    this.isHoveringButton = false;

    document.body.classList.add('show-ui');

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'touchmove'];

    this.activityHandler = this._resetActivityTimer.bind(this);

    events.forEach((event) => {
      document.addEventListener(event, this.activityHandler, { passive: true });
    });

    this._hoverDetection();
    this._resetActivityTimer();
  }

  /**
   * Stop monitoring user activity and clean up listeners.
   */
  _stopActivityTracking() {
    if (!this.isTrackingActivity) return;

    this.isTrackingActivity = false;

    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
      this.activityTimeout = null;
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'touchmove'];

    if (this.activityHandler) {
      events.forEach((event) => {
        document.removeEventListener(event, this.activityHandler);
      });
      this.activityHandler = null;
    }
  }

  /**
   * Reset the activity timer for focus mode UI hiding.
   */
  _resetActivityTimer() {
    if (!this.isTrackingActivity) return;

    document.body.classList.add('show-ui');

    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }

    this.activityTimeout = setTimeout(() => {
      if (this.isTrackingActivity && !this._keepUIVisible()) {
        document.body.classList.remove('show-ui');
      }
    }, 1000);
  }

  /**
   * Configure hover detection to keep UI visible over interactive elements.
   */
  _hoverDetection() {
    const selectors = ['.timer-btn', '.control-btn', '.corner-btn', '.status-bar'];

    selectors.forEach((selector) => {
      const $buttons = document.querySelectorAll(selector);
      $buttons.forEach(($button) => {
        $button.addEventListener('mouseenter', () => {
          this.isHoveringButton = true;
          document.body.classList.add('show-ui');
        });

        $button.addEventListener('mouseleave', () => {
          this.isHoveringButton = false;
          this._resetActivityTimer();
        });
      });
    });
  }

  /**
   * Determine if the UI should remain visible based on user activity.
   * @returns {boolean} True if the UI should stay visible, false otherwise.
   */
  _keepUIVisible() {
    if (this.isHoveringButton) {
      return true;
    }

    const $modals = document.querySelectorAll('.modal');
    for (const $modal of $modals) {
      if ($modal.style.display === 'block' || $modal.classList.contains('show')) {
        return true;
      }
    }

    const $popups = document.querySelectorAll('.popup');
    for (const $popup of $popups) {
      if (!$popup.classList.contains('hidden')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Load and apply saved focus mode preference.
   */
  loadFocusMode() {
    const isEnabled = Storage.getClientSetting('focusMode', false);
    if (isEnabled) this.enableFocusMode();
    this.renderFocusMode();
  }

  /**
   * Activate focus mode with UI auto-hiding.
   */
  enableFocusMode() {
    document.body.classList.add('focus-mode');
    this._startActivityTracking();
  }

  /**
   * Deactivate focus mode and restore normal UI.
   */
  disableFocusMode() {
    document.body.classList.remove('focus-mode', 'show-ui');
    this._stopActivityTracking();
  }

  /**
   * Handle changes to the focus mode toggle setting.
   */
  toggleFocusMode() {
    const isEnabled = Storage.getClientSetting('focusMode', false);

    Storage.saveClientSetting('focusMode', !isEnabled);

    if (!isEnabled) {
      this.enableFocusMode();
    } else {
      this.disableFocusMode();
    }

    this.renderFocusMode();
  }

  /**
   * Handle changes to the repeat toggle setting.
   */
  toggleRepeat() {
    this.app.timer.repeat();
  }

  /**
   * Handle changes to the audio toggle setting.
   * @param {Event} event - The change event from the audio toggle input.
   */
  toggleAudio(event) {
    if (event.target.checked) {
      if (this.app.alerts.volumeIndex === 0) {
        this.app.alerts.volumeIndex = 2;
        this.app.alerts.masterVolume = this.app.alerts.volumeLevels[2];
        this.app.alerts.save();
        this.app.alerts.render();
      }
    } else {
      this.app.alerts.volumeIndex = 0;
      this.app.alerts.masterVolume = 0;
      this.app.alerts.save();
      this.app.alerts.render();
    }
  }

  /**
   * Handle changes to the wake lock toggle setting.
   */
  async toggleWakeLock() {
    const isEnabled = this.noSleep.isEnabled;

    if (!isEnabled) {
      await this.noSleep.enable();
    } else {
      await this.noSleep.disable();
    }

    this.renderWakeLock();
  }

  /**
   * Render the settings form in the settings modal.
   */
  renderSettings() {
    const session = this.app.getCurrentSession();

    this.$sessionNameInput.value = session?.name || '';
    this.$sessionDescInput.value = session?.description || '';
  }

  /**
   * Update the toggle states in the settings modal to reflect current settings.
   */
  renderToggleStates() {
    const session = this.app.getCurrentSession();

    this.$repeatToggle.checked = session?.timer?.repeat || false;
    this.$focusModeToggle.checked = Storage.getClientSetting('focusMode', false);
    this.$audioToggle.checked = this.app.alerts.isReady() && this.app.alerts.volumeIndex > 0;
    this.$wakeLockToggle.checked = this.noSleep.isEnabled;
  }

  /**
   * Refresh focus mode button visual state.
   */
  renderFocusMode() {
    const isEnabled = Storage.getClientSetting('focusMode', false);

    this.$focusModeBtn.title = isEnabled ? 'Click to disable focus mode' : 'Click to enable focus mode';
    this.$focusModeLine.style.display = isEnabled ? 'none' : 'block';
  }

  /**
   * Refresh wake lock button visual state.
   */
  renderWakeLock() {
    const isEnabled = this.noSleep.isEnabled;

    this.$wakeLockBtn.title = isEnabled ? 'Click to disable keep screen awake' : 'Click to keep screen awake';
    this.$wakeLockLine.style.display = isEnabled ? 'none' : 'block';
  }

  /**
   * Render the settings modal with current session data.
   */
  async render() {
    this.renderSettings();
    this.renderToggleStates();
  }

  /**
   * Persist session name and description changes.
   */
  save() {
    if (this.isUpdating) return;

    const session = this.app.getCurrentSession();
    if (!session) return;

    let hasChanges = false;

    if (this.$sessionNameInput.value !== session.name) {
      session.name = this.$sessionNameInput.value.trim();
      hasChanges = true;
    }

    if (this.$sessionDescInput.value !== session.description) {
      session.description = this.$sessionDescInput.value.trim();
      hasChanges = true;
    }

    if (hasChanges) {
      this.app.saveCurrentSession();
      this.app.socket.sessionUpdate(session);
      this.app.sessions.renderDescription(session);
    }
  }

  /**
   * Show the settings modal dialog.
   */
  show() {
    this.render();
    DOM.showModal('settings-modal');
  }
}

export default SettingsManager;
