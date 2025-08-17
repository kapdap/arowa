import Utils, { DOM, Events } from './utils.js';
import TimerCore from './shared/timer-core.js';
import { DEFAULT_DURATION } from './shared/constants.js';

/**
 * Timer manager class.
 */
class Timer {
  /**
   * Create a new Timer instance.
   * @param {Object} app - Main application instance.
   */
  constructor(app) {
    this.app = app;

    this.core = null;
    this.countdown = null;

    this.$intervalName = DOM.getId('interval-name');
    this.$intervalStatus = DOM.getId('interval-status');
    this.$startBtn = DOM.getId('start-btn');
    this.$pauseBtn = DOM.getId('pause-btn');
    this.$stopBtn = DOM.getId('stop-btn');
    this.$nextBtn = DOM.getId('next-btn');
    this.$timerDisplay = DOM.getId('timer-text');
    this.$repeatBtn = DOM.getId('repeat-btn');
    this.$repeatLine = DOM.getId('repeat-disabled-line');

    this._initialize();
  }

  /**
   * Set up timer controls and initial display.
   */
  _initialize() {
    this._listeners();
  }

  /**
   * Configure event listeners for timer control buttons.
   */
  _listeners() {
    Events.on(this.$startBtn, 'click', this.start.bind(this));
    Events.on(this.$pauseBtn, 'click', this.pause.bind(this));
    Events.on(this.$stopBtn, 'click', this.stop.bind(this));
    Events.on(this.$nextBtn, 'click', this.next.bind(this));
    Events.on(this.$repeatBtn, 'click', this.repeat.bind(this));

    Events.on(document, 'appRestarted', this.render.bind(this));

    Events.on(document, 'session_updated', this.render.bind(this));
  }

  /**
   * Begin timer countdown and sync with server.
   */
  start() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.start();

    this.app.saveCurrentSession();
    this.app.socket.timerUpdate(session);

    this.startTimer();
    this.render();
  }

  /**
   * Pause timer countdown and sync with server.
   */
  pause() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.pause();

    this.app.saveCurrentSession();
    this.app.socket.timerUpdate(session);

    this.stopTimer();
    this.render();
  }

  /**
   * Stop timer and reset to initial state.
   */
  stop() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.stop();

    this.app.saveCurrentSession();
    this.app.socket.timerUpdate(session);

    this.stopTimer();
    this.render();
  }

  /**
   * Advance to next timer interval and sync with server.
   */
  next() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.next();

    this.app.saveCurrentSession();
    this.app.socket.timerUpdate(session);

    this.render();
  }

  /**
   * Toggle timer repeat mode setting and sync with server.
   */
  repeat() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.repeat(!session.timer.repeat);

    this.app.saveCurrentSession();
    this.app.socket.timerUpdate(session);

    this.renderState();
    this.renderRepeat();
  }

  /**
   * Update session timer state from TimerCore.
   */
  sync() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.sync();
  }

  /**
   * Begin periodic timer display updates.
   */
  startTimer() {
    this.stopTimer();
    this.countdown = setInterval(() => {
      this.tickTimer();
    }, 200);
  }

  /**
   * Stop periodic timer display updates.
   */
  stopTimer() {
    if (this.countdown) {
      clearInterval(this.countdown);
      this.countdown = null;
    }
  }

  /**
   * Toggle timer start or pause state.
   */
  toggleTimer() {
    const state = this.core.getState();

    if (!state.isRunning || state.isPaused) {
      this.start();
    } else {
      this.pause();
    }
  }

  /**
   * Process timer tick and handle interval transitions.
   */
  tickTimer() {
    const session = this.app.getCurrentSession();
    const oldInterval = session.timer.interval;

    this.sync();

    if (oldInterval !== session.timer.interval) {
      const interval = session.intervals.items[oldInterval];
      this.app.alerts.play(interval.alert);

      session.timer = this.core.getState();
      this.app.saveCurrentSession();

      this.render();
    } else {
      this.renderTimer();
      this.renderState();
    }
  }

  /**
   * Render timer HTML and update display based on current data.
   */
  render() {
    this.renderCSS();
    this.renderTimer();
    this.renderState();
    this.renderRepeat();
  }

  /**
   * Apply custom CSS for the current interval.
   */
  renderCSS() {
    const interval = this.getInterval();
    if (interval && interval.customCSS) {
      Utils.applyCustomCSS(interval.customCSS);
    } else {
      Utils.applyCustomCSS('');
    }
  }

  /**
   * Update timer display elements with current timer and interval info.
   */
  renderTimer() {
    const session = this.app.getCurrentSession();

    if (!session) {
      this.$timerDisplay.textContent = '25:00';
      this.$intervalName.textContent = 'Focus';
      this.$intervalStatus.textContent = '1/2';
      return;
    }

    this.$timerDisplay.textContent = Utils.formatTime(Math.ceil(session.timer.remaining / 1000));

    const interval = this.getInterval();
    if (interval) this.$intervalName.textContent = interval.name;

    const current = session.timer.interval + 1;
    const total = session.intervals.items.length;
    this.$intervalStatus.textContent = `${current}/${total}`;

    const isRunning = session.timer.isRunning;
    const isPaused = session.timer.isPaused;

    this.$startBtn.style.display = !isRunning || isPaused ? 'flex' : 'none';
    this.$pauseBtn.style.display = isRunning && !isPaused ? 'flex' : 'none';
    this.$nextBtn.style.display = 'flex';
  }

  /**
   * Update timer state classes on the document body based on timer state.
   */
  renderState() {
    const session = this.app.getCurrentSession();
    const body = document.body;

    body.classList.remove('timer-running', 'timer-paused', 'timer-stopped', 'timer-repeat');

    if (!session) {
      body.classList.add('timer-stopped');
      return;
    }

    const isRunning = session.timer.isRunning;
    const isPaused = session.timer.isPaused;

    if (isRunning && !isPaused) {
      body.classList.add('timer-running');
    } else if (isRunning && isPaused) {
      body.classList.add('timer-running', 'timer-paused');
    } else {
      body.classList.add('timer-stopped');
    }

    if (session.timer.repeat) {
      body.classList.add('timer-repeat');
    }
  }

  /**
   * Update repeat mode button display based on current repeat state.
   */
  renderRepeat() {
    const session = this.app.getCurrentSession();
    const repeat = session ? session.timer.repeat : false;
    this.$repeatBtn.title = repeat ? 'Click to disable repeat mode' : 'Click to enable repeat mode';
    this.$repeatLine.style.display = repeat ? 'none' : 'block';
  }

  /**
   * Reload and initialize timer with current session data.
   * @param {boolean} [local=false] - Whether to use local timer state or sync with server.
   */
  reload(local = false) {
    const session = this.app.getCurrentSession();
    this.core = new TimerCore(session.intervals.items);

    if (local) {
      this.core.setState(session.timer);
      session.timer = this.core.sync();
    } else {
      session.timer = this.core.updateState(session.timer);
    }

    if (session.timer.isRunning && !session.timer.isPaused) {
      this.startTimer();
    }

    this.render();
  }

  /**
   * Update timer state from session data.
   */
  update() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.updateState(session.timer);

    if (session.timer.isRunning && !session.timer.isPaused) {
      if (!this.countdown) this.startTimer();
    } else {
      this.stopTimer();
    }

    this.render();
  }

  /**
   * Get the current timer state object.
   * @returns {Object} The current timer state.
   */
  getState() {
    if (!this.core) {
      return {
        isRunning: false,
        isPaused: false,
        interval: 0,
        remaining: DEFAULT_DURATION * 1000,
        repeat: false,
        startedInterval: 0,
        startedAt: 0,
        pausedAt: 0,
        timePaused: 0,
      };
    }

    return this.core.getState();
  }

  /**
   * Get the current interval object from the session.
   * @returns {Object|null} The current interval object, or null if unavailable.
   */
  getInterval() {
    const session = this.app.getCurrentSession();
    if (!session) return null;

    if (!session.intervals?.items) {
      console.warn('No intervals in session');
      return null;
    }

    const state = this.core.getState();
    const index = state.interval;

    return session.intervals.items[index] || null;
  }

  /**
   * Update the intervals list and adjust timer state accordingly.
   */
  updateIntervals() {
    const session = this.app.getCurrentSession();
    session.timer = this.core.updateIntervals(session.intervals.items);
  }

  /**
   * Dispose timer resources and clear intervals.
   */
  dispose() {
    this.stopTimer();
    this.core = null;
  }
}

export default Timer;
