/**
 * Core timer calculation logic shared between server and client.
 */
import { DEFAULT_DURATION } from './constants.js';

/**
 * Timer core class for managing timer state and calculations.
 */
class TimerCore {
  /**
   * Create a new TimerCore instance.
   * @param {Array} [intervals=[]] - Array of interval objects with duration property in seconds.
   */
  constructor(intervals = []) {
    this.intervals = intervals;
    this.state = {
      // Shared timer state
      repeat: false,
      interval: 0,
      remaining: (intervals[0]?.duration ?? DEFAULT_DURATION) * 1000,
      isRunning: false,
      isPaused: false,

      // Internal timing state
      startedInterval: 0,
      startedAt: 0,
      pausedAt: 0,
      timePaused: 0,
    };
  }

  /**
   * Start the timer from current interval or resume from pause.
   * @returns {Object} Updated timer state object.
   */
  start() {
    const timer = this.state;

    // Handle resume from pause
    if (timer.isPaused) {
      this.resume();
    } else if (!timer.isRunning) {
      timer.startedInterval = timer.interval;
      timer.startedAt = Date.now();
      timer.timePaused = 0;
    }

    // Update timer state
    timer.isRunning = true;
    timer.isPaused = false;
    timer.pausedAt = 0;

    return { ...timer };
  }

  /**
   * Pause the timer at current time.
   * @returns {Object} Updated timer state object.
   */
  pause() {
    const timer = this.state;

    // Update timer state
    timer.isPaused = true;
    timer.pausedAt = Date.now();

    return { ...timer };
  }

  /**
   * Stop the timer and reset to initial state at first interval.
   * @returns {Object} Updated timer state object.
   */
  stop() {
    const timer = this.state;

    // Reset timer state
    timer.isRunning = false;
    timer.isPaused = false;
    timer.interval = 0;
    timer.remaining = (this.intervals[0]?.duration ?? DEFAULT_DURATION) * 1000;
    timer.startedInterval = 0;
    timer.startedAt = 0;
    timer.pausedAt = 0;
    timer.timePaused = 0;

    return { ...timer };
  }

  /**
   * Toggle repeat mode or set it explicitly.
   * @param {boolean} [repeat] - Set repeat mode to this value, or toggle if not provided.
   * @returns {Object} Updated timer state object.
   */
  repeat(repeat = null) {
    const timer = this.state;
    timer.repeat = Boolean(repeat ?? !timer.repeat);
    return { ...timer };
  }

  /**
   * Move to next interval, wrapping to first if at end.
   * @returns {Object} Updated timer state object.
   */
  next() {
    const timer = this.state;
    const now = Date.now();

    if (++timer.interval >= this.intervals.length) {
      timer.interval = 0;
    }

    timer.remaining = (this.intervals[timer.interval]?.duration ?? DEFAULT_DURATION) * 1000;

    if (timer.isRunning) {
      timer.startedInterval = timer.interval;
      timer.startedAt = now;
      timer.pausedAt = timer.isPaused ? now : 0;
      timer.timePaused = 0;
    }

    return { ...timer };
  }

  /**
   * Resume timer from paused state.
   * @returns {Object} Updated timer state object.
   */
  resume() {
    const now = Date.now();
    const timer = this.state;

    if (timer.isPaused) {
      // Add pause duration to total paused time
      timer.isPaused = false;
      timer.timePaused += now - timer.pausedAt;
      timer.pausedAt = 0;
    }

    return { ...timer };
  }

  /**
   * Synchronize timer state based on elapsed time and interval durations.
   * @returns {Object} Updated timer state object.
   */
  sync() {
    const now = Date.now();
    const timer = this.state;

    // Validate timer state
    if (!timer.isRunning || !timer.startedAt) return { ...timer };

    // Validate intervals
    const intervals = this.intervals;
    if (!intervals || intervals.length === 0) return { ...timer };

    // Calculate actual elapsed time
    const offset = timer.isPaused && timer.pausedAt > 0 ? now - timer.pausedAt : 0;
    const elapsed = now - timer.startedAt - timer.timePaused - offset;

    // Find current interval starting from startedInterval
    let current = timer.startedInterval;
    if (current >= intervals.length) current = 0;

    // Calculate remaining time in the `current` interval
    let remaining = elapsed;
    while (remaining > 0) {
      const duration = intervals[current].duration * 1000;
      if (remaining < duration) break;

      remaining -= duration;
      current++;

      // Handle repeat mode wraparound
      if (current >= intervals.length && timer.repeat) {
        current = 0;
      }

      // Check if timer should stop (no repeat and reached end)
      if (current >= intervals.length && !timer.repeat) {
        timer.isRunning = false;
        timer.isPaused = false;
        timer.interval = 0;
        timer.remaining = intervals[0].duration * 1000;
        timer.startedAt = 0;
        timer.startedInterval = 0;
        timer.pausedAt = 0;
        timer.timePaused = 0;
        return { ...timer };
      }
    }

    // Update session state
    timer.interval = current;
    timer.remaining = intervals[current].duration * 1000 - remaining;

    return { ...timer };
  }

  /**
   * Update intervals array and adjust timer state if necessary.
   * TODO: Fix bug - time remaining is calculated incorrectly when duration is changed
   * @param {Array} intervals - Array of interval objects with duration property in seconds.
   * @returns {Object} Updated timer state object.
   */
  updateIntervals(intervals) {
    this.intervals = intervals;

    const now = Date.now();
    const timer = this.state;

    // Last interval deleted, reset to first interval
    if (timer.interval >= intervals.length) {
      timer.remaining = (intervals[0]?.duration ?? DEFAULT_DURATION) * 1000;
      timer.interval = 0;
      timer.startedInterval = 0;
      timer.startedAt = timer.startedAt ? now : 0;
      timer.pausedAt = timer.pausedAt ? now : 0;
      timer.timePaused = 0;

      return { ...timer };
    }

    const duration = (intervals[timer.interval]?.duration ?? DEFAULT_DURATION) * 1000;

    if (timer.isRunning) {
      const elapsed = now - timer.startedAt - timer.timePaused;

      timer.startedAt = now - elapsed;
      timer.startedInterval = timer.interval;
      timer.timePaused = 0;
      timer.pausedAt = timer.isPaused ? now : 0;

      if (timer.remaining > duration) {
        timer.remaining = duration;
        timer.startedAt = now;
      }

      return { ...timer };
    }

    timer.remaining = duration;

    return { ...timer };
  }

  /**
   * Update timer state from external source.
   * @param {Object} state - Timer state object from external source.
   * @returns {Object} Updated timer state object.
   */
  updateState(state) {
    const timer = this.state;
    const now = Date.now();

    // Update timer state from source
    timer.repeat = state.repeat;
    timer.interval = state.interval;
    timer.remaining = state.remaining;
    timer.isRunning = state.isRunning;
    timer.isPaused = state.isPaused;

    // Calculate elapsed time
    const duration = (this.intervals[timer.interval]?.duration ?? DEFAULT_DURATION) * 1000;
    const elapsed = duration - timer.remaining;

    // Reset timer baseline
    timer.startedInterval = timer.interval;
    timer.startedAt = timer.isRunning ? now - elapsed : 0; // Calculate when this interval would have started by subtracting elapsed time from current time
    timer.pausedAt = timer.isPaused ? now : 0;
    timer.timePaused = 0;

    return { ...timer };
  }

  /**
   * Get copy of current timer state.
   * @returns {Object} Current timer state object.
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Set timer state for initialization or restoration.
   * @param {Object} state - Timer state object to merge into current state.
   */
  setState(state) {
    this.state = { ...this.state, ...state };
  }
}

export default TimerCore;

// Browser export
if (typeof window !== 'undefined') {
  window.TimerCore = TimerCore;
}
