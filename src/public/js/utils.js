/**
 * Utility functions for the timer application.
 */

import { CLIENT_ID_REGEX, SESSION_ID_REGEX, DEFAULT_DURATION } from './shared/constants.js';

/**
 * Generate a unique client ID (UUID v4 format).
 * @returns {string} A randomly generated UUID v4 string.
 */
function generateClientId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a session ID from a string or random 8-character alphanumeric string.
 * @param {string} [sessionId=null] - Optional session ID to sanitize.
 * @returns {string} A randomly generated session ID string.
 */
function generateSessionId(sessionId = null) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

  // Sanitize provided session ID
  if (sessionId) {
    let id = sessionId.toLowerCase();

    id = id.replace(/[^a-z0-9-]+/g, '-');
    id = id.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

    if (id.length > 64) id = id.substring(0, 64);
    if (id.length > 0) {
      // Ensure minimum length of 3 characters
      while (id.length > 0 && id.length < 3) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return id;
    }
  }

  // Generate random 8-character session id
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Validate the format of a session ID string.
 * @param {string} sessionId - Session ID to validate.
 * @returns {boolean} True if the session ID is valid.
 */
function isValidSessionId(sessionId) {
  return SESSION_ID_REGEX.test(sessionId);
}

/**
 * Validate the format of a client ID string.
 * @param {string} clientId - Client ID to validate.
 * @returns {boolean} True if the client ID is valid.
 */
function isValidClientId(clientId) {
  return CLIENT_ID_REGEX.test(clientId);
}

/**
 * Get the session ID from the current URL path.
 * @returns {string|null} Session ID if present, otherwise null.
 */
function getSessionIdFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/^\/([^/]{1,64})(?:\/|$)/);
  return match ? match[1] : null;
}

/**
 * Set the session ID in the browser URL path without reloading the page.
 * @param {string} sessionId - Session ID to set in the URL.
 */
function setSessionIdInUrl(sessionId) {
  const newUrl = `/${sessionId}`;
  if (window.location.pathname !== newUrl) {
    window.history.pushState({ sessionId }, '', newUrl);
  }
}

/**
 * Create a default session object structure.
 * @param {string|null} sessionId - Optional session ID to assign.
 * @returns {Object} Default session object.
 */
function createDefaultSession(sessionId = null) {
  const clientId = generateClientId();
  const hashedId = getSHA256(clientId);
  const avatarUrl = getGravatarUrl(hashedId);

  return {
    sessionId: isValidSessionId(sessionId) ? sessionId : generateSessionId(),
    name: 'Focus and Break Session',
    description: 'Focus and break timer',
    intervals: {
      lastUpdated: 0,
      items: [
        {
          name: 'Focus',
          duration: DEFAULT_DURATION, // 25 minutes in seconds
          alert: 'Gentle',
          customCSS: `/* Body Background */
body {
  background: linear-gradient(45deg, #ffeaa7, #fab1a0);
}

/* Timer Display Styling */
.timer-display {
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
  border: none;
}

/* Timer Indicators */
.timer-btn {
  color: #c14242;
}

.timer-btn:hover {
  color: #971e1e;
}`,
        },
        {
          name: 'Break',
          duration: 300, // 5 minutes
          alert: 'Default',
          customCSS: `/* Body Background */
body {
  background: linear-gradient(45deg, #a8edea, #fed6e3);
}

/* Timer Display Styling */
.timer-display {
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
  box-shadow: 0 10px 30px rgba(78, 205, 196, 0.3);
  border: none;
  color: white;
}

/* Timer Indicators */
.timer-btn {
  color: #3c9382;
}

.timer-btn:hover {
  color: #236b6f;
}`,
        },
      ],
    },
    timer: {
      repeat: false,
      interval: 0,
      remaining: DEFAULT_DURATION * 1000, // 25 minutes in milliseconds
      isRunning: false,
      isPaused: false,
      startedAt: 0,
      startedInterval: 0,
      pausedAt: 0,
      timePaused: 0,
    },
    users: {},
    user: {
      clientId,
      hashedId,
      name: '',
      email: '',
      avatarUrl,
    },
  };
}

/**
 * Generate a Gravatar URL for the given email or URL and image size.
 * @param {string} emailOrUrl - User's email address or an existing Gravatar URL.
 * @param {number} [size=80] - Desired image size in pixels.
 * @returns {string} Gravatar image URL.
 */
function getGravatarUrl(emailOrUrl, size = 80) {
  if (!emailOrUrl) {
    // If no email, use a random string to generate a unique avatar
    const random = Math.random().toString(36).substring(2, 15);
    return generateGravatarUrl(random, size);
  }

  if (emailOrUrl.startsWith('https://www.gravatar.com/avatar/')) {
    const baseUrl = emailOrUrl.split('?')[0];
    return `${baseUrl}?s=${size}&d=identicon&r=pg`;
  }

  const email = emailOrUrl.toLowerCase().trim();
  return generateGravatarUrl(email, size);
}

/**
 * Generate a Gravatar URL for a preprocessed email and image size.
 * @param {string} email - Preprocessed email or identifier to hash for Gravatar.
 * @param {number} [size=80] - Desired image size in pixels.
 * @returns {string} Gravatar image URL.
 */
function generateGravatarUrl(email, size = 80) {
  const hash = getSHA256(email);
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon&r=pg`;
}

/**
 * Copy text to the clipboard using the modern Clipboard API or fallback.
 * @param {string} text - Text to copy to the clipboard.
 * @returns {Promise<void>} Promise that resolves when the text is copied.
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return legacyCopyToClipboard(text);
}

/**
 * Copy text to the clipboard using a legacy method.
 * @param {string} text - Text to copy to the clipboard.
 * @returns {Promise<void>} Promise that resolves when the text is copied.
 */
function legacyCopyToClipboard(text) {
  return new Promise((resolve, reject) => {
    const $textarea = DOM.create('textarea', {
      value: text,
      style: 'position: fixed; top: -9999px; left: -9999px; opacity: 0;',
    });

    document.body.appendChild($textarea);

    try {
      $textarea.select();
      $textarea.setSelectionRange(0, 99999); // For mobile devices

      const successful = document.execCommand('copy');
      document.body.removeChild($textarea);

      if (successful) {
        resolve();
      } else {
        reject(new Error('Copy command failed'));
      }
    } catch (error) {
      document.body.removeChild($textarea);
      reject(error);
    }
  });
}

/**
 * Apply custom CSS from the current interval to the document.
 * @param {string} css - Custom CSS string to apply.
 */
function applyCustomCSS(css) {
  const $existing = DOM.getId('custom-interval-css');
  if ($existing) $existing.remove();

  if (css.trim()) {
    const $style = DOM.create('style', {
      id: 'custom-interval-css',
      type: 'text/css',
    });
    $style.textContent = css;
    document.head.appendChild($style);
  }
}

/**
 * Format a time value in seconds as MM:SS.
 * @param {number} time - Time in seconds.
 * @returns {string} Time formatted as MM:SS.
 */
function formatTime(time) {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Create a debounced version of a function.
 * @param {Function} func - Function to debounce.
 * @param {number} wait - Wait time in milliseconds.
 * @returns {Function} Debounced function.
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const interval = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(interval, wait);
  };
}

/**
 * SHA256 hash function instance. Using jshashes
 * library instead of WebCrypto API for better
 * browser compatibility.
 * @see https://github.com/h2non/jshashes
 */
const sha256Hash = new Hashes.SHA256();

/**
 * Hash a string using SHA256.
 * @param {string} input - String to hash.
 * @returns {string} Hex-encoded SHA-256 hash string.
 */
function getSHA256(input) {
  return sha256Hash.hex(input);
}

/**
 * DOM utility functions.
 */
const DOM = {
  /**
   * Get element by ID.
   * @param {string} id - Element ID.
   * @returns {HTMLElement|null} Element or null.
   */
  getId(id) {
    return document.getElementById(id);
  },

  /**
   * Query selector.
   * @param {string} selector - CSS selector.
   * @returns {HTMLElement|null} Element or null.
   */
  query(selector) {
    return document.querySelector(selector);
  },

  /**
   * Query all selectors.
   * @param {string} selector - CSS selector.
   * @returns {NodeList} NodeList of elements.
   */
  queryAll(selector) {
    return document.querySelectorAll(selector);
  },

  /**
   * Create element with attributes and text content.
   * @param {string} tag - HTML tag name.
   * @param {Object} [attributes={}] - Attributes object.
   * @param {string} [textContent=""] - Text content.
   * @returns {HTMLElement} Created element.
   */
  create(tag, attributes = {}, textContent = '') {
    const $element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        $element.className = value;
      } else if (key.startsWith('data-')) {
        $element.setAttribute(key, value);
      } else {
        $element[key] = value;
      }
    });

    if (textContent) {
      $element.textContent = textContent;
    }

    return $element;
  },

  /**
   * Show modal.
   * @param {string} modalId - Modal element ID.
   */
  showModal(modalId) {
    const $modal = this.getId(modalId);
    if ($modal) {
      $modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * Hide modal.
   * @param {string} modalId - Modal element ID.
   */
  hideModal(modalId) {
    const $modal = this.getId(modalId);
    if ($modal) {
      $modal.classList.remove('show');
      document.body.style.overflow = '';
    }
  },

  /**
   * Close all currently open modal dialogs.
   */
  hideAllModals() {
    const $modals = DOM.queryAll('.modal.show');
    $modals.forEach(($modal) => {
      DOM.hideModal($modal.id);
    });
  },

  /**
   * Show popup with standard pattern.
   * @param {string} popupId - Popup element ID.
   */
  showPopup(popupId) {
    const $popup = this.getId(popupId);
    if ($popup) $popup.classList.remove('hidden');
  },

  /**
   * Hide popup with standard pattern.
   * @param {string} popupId - Popup element ID.
   */
  hidePopup(popupId) {
    const $popup = this.getId(popupId);
    if ($popup) $popup.classList.add('hidden');
  },
};

/**
 * Event utility functions.
 */
const Events = {
  /**
   * Add event listener.
   * @param {HTMLElement|Window|Document} target - Event target.
   * @param {string} event - Event name.
   * @param {Function} handler - Event handler.
   * @param {boolean|Object} options - Event options.
   */
  on(target, event, handler, options = false) {
    if (target && target.addEventListener) {
      target.addEventListener(event, handler, options);
    }
  },

  /**
   * Remove event listener.
   * @param {HTMLElement|Window|Document} target - Event target.
   * @param {string} event - Event name.
   * @param {Function} handler - Event handler.
   * @param {boolean|Object} options - Event options.
   */
  off(target, event, handler, options = false) {
    if (target && target.removeEventListener) {
      target.removeEventListener(event, handler, options);
    }
  },

  /**
   * Dispatch custom event.
   * @param {HTMLElement|Window|Document} target - Event target.
   * @param {string} eventName - Event name.
   * @param {Object} detail - Event data.
   */
  dispatch(target, eventName, detail = {}) {
    if (target && target.dispatchEvent) {
      const event = new CustomEvent(eventName, { detail });
      target.dispatchEvent(event);
    }
  },
};

/**
 * Storage utility for LocalStorage operations.
 */
const Storage = {
  /**
   * Get session data from storage.
   * @returns {Object} Session data object.
   */
  getSessionData() {
    try {
      const data = localStorage.getItem('session_data');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error parsing session data:', error);
      return {};
    }
  },

  /**
   * Save session data to storage.
   * @param {Object} data - Session data to save.
   */
  saveSessionData(data) {
    try {
      localStorage.setItem('session_data', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  },

  /**
   * Load session from storage or create a new one if it doesn't exist.
   * @param {string} sessionId - Session ID.
   * @returns {Object} Session object.
   */
  loadSession(sessionId) {
    return this.getSession(sessionId) ?? createDefaultSession(sessionId);
  },

  /**
   * Get specific session by ID.
   * @param {string} sessionId - Session ID.
   * @returns {Object|null} Session object or null.
   */
  getSession(sessionId) {
    const session = this.getSessionData()?.[sessionId];
    if (!session) return null;
    session.sessionId = sessionId;
    return session;
  },

  /**
   * Save specific session.
   * @param {Object} session - Session object.
   */
  saveSession(session) {
    const sessionId = session.sessionId;

    const sessions = this.getSessionData();
    const existing = sessions[sessionId];

    sessions[sessionId] = {
      sessionId,
      name: session?.name || '',
      description: session?.description || '',
      intervals: session?.intervals
        ? {
            lastUpdated: session.intervals?.lastUpdated || 0,
            items: session.intervals?.items || [],
          }
        : {
            lastUpdated: 0,
            items: [],
          },
      timer: session?.timer || {
        repeat: false,
        interval: 0,
        remaining: 0,
        isRunning: false,
        isPaused: false,
      },
      user: session?.user ||
        (existing && existing?.user) || {
          hashedId: '',
          clientId: '',
          name: '',
          email: '',
          avatarUrl: '',
        },
    };

    this.saveSessionData(sessions);
  },

  /**
   * Delete specific session.
   * @param {string} sessionId - Session ID.
   */
  deleteSession(sessionId) {
    const sessions = this.getSessionData();

    if (!sessions[sessionId]) {
      console.warn('Session not found:', sessionId);
      return;
    }

    delete sessions[sessionId];

    this.saveSessionData(sessions);

    console.log('Deleted session:', sessionId);
  },

  /**
   * Get all session IDs.
   * @returns {string[]} Array of session IDs.
   */
  getAllSessionIds() {
    const sessions = this.getSessionData();
    return Object.keys(sessions);
  },

  /**
   * Clear all sessions.
   */
  clearAllSessions() {
    localStorage.removeItem('session_data');
  },

  /**
   * Get client configuration from storage.
   * @returns {Object} Client configuration object.
   */
  getClientConfig() {
    try {
      const data = localStorage.getItem('client_config');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error parsing client config:', error);
      return {};
    }
  },

  /**
   * Save client configuration to storage.
   * @param {Object} config - Client configuration to save.
   */
  saveClientConfig(config) {
    try {
      localStorage.setItem('client_config', JSON.stringify(config));
    } catch (error) {
      console.error('Error saving client config:', error);
    }
  },

  /**
   * Get specific client setting.
   * @param {string} key - Setting key.
   * @param {*} defaultValue - Default value if key doesn't exist.
   * @returns {*} Setting value.
   */
  getClientSetting(key, defaultValue = null) {
    const config = this.getClientConfig();
    return config[key] !== undefined ? config[key] : defaultValue;
  },

  /**
   * Save specific client setting.
   * @param {string} key - Setting key.
   * @param {*} value - Setting value.
   */
  saveClientSetting(key, value) {
    const config = this.getClientConfig();
    config[key] = value;
    this.saveClientConfig(config);
  },
};

/**
 * Confirm dialog utility class for showing confirmation dialogs.
 */
class ConfirmDialog {
  /**
   * Create a ConfirmDialog instance for showing confirmation dialogs.
   */
  constructor() {
    this.isDialogOpen = false;
    this.currentResolve = null;

    this.$modal = DOM.getId('confirm-modal');
    this.$messageEl = DOM.getId('confirm-message');
    this.$okBtn = DOM.getId('confirm-ok-btn');
    this.$cancelBtn = DOM.getId('confirm-cancel-btn');

    this._initialize();
  }

  /**
   * Initialize the confirm dialog by setting up event listeners.
   */
  _initialize() {
    this._listeners();
  }

  /**
   * Setup event listeners for the confirm dialog.
   */
  _listeners() {
    Events.on(this.$okBtn, 'click', () => this.resolve(true));
    Events.on(this.$cancelBtn, 'click', () => this.resolve(false));

    Events.on(document, 'keydown', (e) => {
      if (!this.isDialogOpen) return;

      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          this.resolve(true);
          break;

        case 'Escape':
          e.preventDefault();
          this.resolve(false);
          break;
      }
    });

    // Click outside to cancel (optional)
    Events.on(this.$modal, 'click', (e) => {
      if (e.target === this.$modal) {
        this.resolve(false);
      }
    });
  }

  /**
   * Show confirm dialog with a message.
   * @param {string} message - Message to display.
   * @param {Object} options - Optional configuration.
   * @param {string} options.okText - Text for OK button (default: 'OK').
   * @param {string} options.cancelText - Text for Cancel button (default: 'Cancel').
   * @returns {Promise<boolean>} Promise that resolves to true if confirmed, false if cancelled.
   */
  show(message, options = {}) {
    return new Promise((resolve) => {
      if (this.isDialogOpen && this.currentResolve) {
        // If dialog is already open, reject the previous promise and start new one
        this.currentResolve(false);
      }

      this.currentResolve = resolve;
      this.isDialogOpen = true;

      this.$messageEl.textContent = message;
      this.$okBtn.textContent = options.okText || 'OK';
      this.$cancelBtn.textContent = options.cancelText || 'Cancel';

      DOM.showModal('confirm-modal');

      setTimeout(() => {
        this.$cancelBtn.focus();
      }, 100);
    });
  }

  /**
   * Resolve the current promise and hide the dialog.
   * @param {boolean} result - Result to resolve with.
   */
  resolve(result) {
    if (!this.isDialogOpen || !this.currentResolve) return;

    this.isOpen = false;
    const resolve = this.currentResolve;
    this.currentResolve = null;

    DOM.hideModal('confirm-modal');

    resolve(result);
  }

  /**
   * Check if dialog is currently open.
   * @returns {boolean} True if dialog is open.
   */
  isOpen() {
    return this.isDialogOpen;
  }
}

const confirmDialog = new ConfirmDialog();

/**
 * Show a confirmation dialog and return the user's response.
 * @param {string} message - Message to display in the dialog.
 * @param {Object} [options={}] - Optional configuration for the dialog.
 * @returns {Promise<boolean>} Promise that resolves to true if confirmed, false if cancelled.
 */
function showConfirm(message, options = {}) {
  return confirmDialog.show(message, options);
}

/**
 * Display temporary notification message with auto-dismiss.
 * @param {string} message - Notification message to display.
 * @param {string} [type="info"] - Notification type: 'success', 'error', or 'info'.
 * @param {string} [id="utility-notification"] - Notification element ID.
 */
function showNotification(message, type = 'info', id = 'utility-notification') {
  const $existing = DOM.getId(id);
  if ($existing) $existing.remove();

  const $notification = DOM.create(
    'div',
    {
      id,
      className: `notification ${type}`,
    },
    message
  );

  document.body.appendChild($notification);

  setTimeout(() => {
    $notification.style.animation = 'slideUpToTop 0.3s ease';
    setTimeout(() => {
      if ($notification.parentNode) {
        $notification.parentNode.removeChild($notification);
      }
    }, 300);
  }, 3000);
}

export default {
  generateClientId,
  generateSessionId,
  isValidSessionId,
  isValidClientId,
  getSessionIdFromUrl,
  setSessionIdInUrl,
  createDefaultSession,
  getGravatarUrl,
  generateGravatarUrl,
  copyToClipboard,
  legacyCopyToClipboard,
  applyCustomCSS,
  formatTime,
  debounce,
  getSHA256,

  showConfirm,
  showNotification,

  DOM,
  Events,
  Storage,
};

export { DOM, Events, Storage };
