import Utils, { DOM, Events } from './utils.js';

/**
 * Share manager for handling session sharing functionality.
 */
class ShareManager {
  /**
   * Create a ShareManager instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.$shareBtn = DOM.getId('share-btn');
    this.$copyBtn = DOM.getId('share-copy-btn');
    this.$shareInput = DOM.getId('share-url');
    this.$qrContainer = DOM.getId('share-qr-code');

    this._initialize();
  }

  /**
   * Set up share functionality event handlers.
   */
  _initialize() {
    this._listeners();
  }

  /**
   * Configure event listeners for share UI controls.
   */
  _listeners() {
    Events.on(this.$shareBtn, 'click', this.share.bind(this));
    Events.on(this.$copyBtn, 'click', this.copy.bind(this));
  }

  /**
   * Share session URL via clipboard or modal fallback.
   */
  share() {
    const session = this.app.getCurrentSession();
    const url = this.generateUrl(session);

    try {
      Utils.copyToClipboard(url);
      this.showNotification();
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      this.show(url);
    }
  }

  /**
   * Copy the current session URL to the clipboard.
   */
  copy() {
    const session = this.app.getCurrentSession();
    const url = this.generateUrl(session);

    try {
      Utils.copyToClipboard(url);
      this.showNotification();
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
    }
  }

  /**
   * Display share modal with URL input and QR code.
   * @param {string} url - The session URL to display and encode in the QR code.
   */
  show(url) {
    this.$shareInput.value = url;

    this.generateQrCode(url);

    DOM.showModal('share-modal');

    setTimeout(() => {
      this.$shareInput.select();
      this.$shareInput.setSelectionRange(0, 99999);
    }, 100);
  }

  /**
   * Display success notification for URL copy operation.
   */
  showNotification() {
    Utils.showNotification('Session URL copied to clipboard!', 'success', 'share-notification');
  }

  /**
   * Build complete session URL from session ID.
   * @param {Object} session - The session object containing sessionId.
   * @returns {string} The full session URL.
   */
  generateUrl(session) {
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}/${session.sessionId}`;
  }

  /**
   * Create and render QR code using qr-creator library for session URL.
   * @see https://github.com/nimiq/qr-creator
   * @param {string} url - The session URL to encode in the QR code.
   */
  generateQrCode(url) {
    this.$qrContainer.innerHTML = '';

    try {
      QrCreator.render(
        {
          text: url,
          radius: 0,
          ecLevel: 'L',
          fill: '#000000',
          background: '#ffffff',
          size: 200,
        },
        this.$qrContainer
      );
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      this.$qrContainer.innerHTML = '<p style="text-align: center; padding: 20px;">QR code generation failed</p>';
    }
  }
}

export default ShareManager;
