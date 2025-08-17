/**
 * Tests for Timer class
 * Testing the actual Timer class methods without mocks
 */

import type { TimerStateInternal } from '../../src/types/messages';
import Timer from '../../src/shared/timer-core';

/**
 * Returns a default TimerStateInternal merged with the provided partial.
 * @param {Partial<TimerStateInternal>} partial
 * @returns {TimerStateInternal}
 */
function createTimerState(partial: Partial<TimerStateInternal> = {}): TimerStateInternal {
  return {
    repeat: false,
    interval: 0,
    remaining: 25000,
    isRunning: false,
    isPaused: false,
    startedAt: 0,
    startedInterval: 0,
    pausedAt: 0,
    timePaused: 0,
    ...partial,
  };
}

describe('Timer', () => {
  let timer: Timer;
  const mockIntervals = [
    { name: 'Work', duration: 25, alert: 'Default', customCSS: '' },
    { name: 'Break', duration: 5, alert: 'Default', customCSS: '' },
    { name: 'Long Break', duration: 15, alert: 'Default', customCSS: '' },
  ];

  beforeEach(() => {
    timer = new Timer(mockIntervals);
  });

  describe('constructor', () => {
    it('should initialize with intervals and default state', () => {
      const state = timer.getState();
      expect(state.repeat).toBe(false);
      expect(state.interval).toBe(0);
      expect(state.remaining).toBe(25000); // 25 seconds in milliseconds
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.startedAt).toBe(0);
      expect(state.startedInterval).toBe(0);
      expect(state.pausedAt).toBe(0);
      expect(state.timePaused).toBe(0);
    });

    it('should store the passed intervals correctly', () => {
      expect(timer.intervals).toEqual(mockIntervals);
    });

    it('should initialize with empty intervals array', () => {
      const emptyTimer = new Timer([]);
      const state = emptyTimer.getState();
      expect(state.remaining).toBe(1500000); // DEFAULT_DURATION in milliseconds
    });

    it('should initialize without intervals parameter', () => {
      const defaultTimer = new Timer();
      const state = defaultTimer.getState();
      expect(state.remaining).toBe(1500000); // DEFAULT_DURATION in milliseconds
    });
  });

  describe('start()', () => {
    it('should start the timer from stopped state', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const result = timer.start();

      expect(result.isRunning).toBe(true);
      expect(result.isPaused).toBe(false);
      expect(result.startedAt).toBe(mockTime);
      expect(result.startedInterval).toBe(0);
      expect(result.timePaused).toBe(0);
      expect(result.pausedAt).toBe(0);
    });

    it('should resume from paused state', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      // Start timer
      timer.start();

      // Advance time and pause
      advanceTime(5000);
      timer.pause();

      // Advance time while paused
      advanceTime(3000);

      // Resume (start from paused state)
      const result = timer.start();

      expect(result.isRunning).toBe(true);
      expect(result.isPaused).toBe(false);
      expect(result.pausedAt).toBe(0);
      expect(result.timePaused).toBe(3000);
    });

    it('should not reset timing when already running', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      const firstStartedAt = timer.getState().startedAt;

      advanceTime(2000);
      const result = timer.start();

      expect(result.startedAt).toBe(firstStartedAt);
      expect(result.isRunning).toBe(true);
    });
  });

  describe('pause()', () => {
    it('should pause the timer', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(5000);

      const result = timer.pause();

      expect(result.isPaused).toBe(true);
      expect(result.pausedAt).toBe(mockTime + 5000);
      expect(result.isRunning).toBe(true); // Still running, just paused
    });

    it('should work when timer is not running', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const result = timer.pause();

      expect(result.isPaused).toBe(true);
      expect(result.pausedAt).toBe(mockTime);
    });
  });

  describe('stop()', () => {
    it('should stop and reset the timer', () => {
      timer.start();
      advanceTime(5000);
      timer.pause();

      const result = timer.stop();

      expect(result.isRunning).toBe(false);
      expect(result.isPaused).toBe(false);
      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(25000); // 25 seconds in milliseconds
      expect(result.startedAt).toBe(0);
      expect(result.startedInterval).toBe(0);
      expect(result.pausedAt).toBe(0);
      expect(result.timePaused).toBe(0);
    });

    it('should reset to first interval duration', () => {
      const customIntervals = [{ name: 'Custom', duration: 30, alert: 'Default', customCSS: '' }];
      const customTimer = new Timer(customIntervals);

      customTimer.start();
      const result = customTimer.stop();

      expect(result.remaining).toBe(30000); // 30 seconds in milliseconds
    });

    it('should handle empty intervals', () => {
      const emptyTimer = new Timer([]);
      emptyTimer.start();

      const result = emptyTimer.stop();

      expect(result.remaining).toBe(1500000); // DEFAULT_DURATION in milliseconds
    });
  });

  describe('repeat()', () => {
    it('should toggle repeat mode when no parameter provided', () => {
      expect(timer.getState().repeat).toBe(false);

      let result = timer.repeat();
      expect(result.repeat).toBe(true);

      result = timer.repeat();
      expect(result.repeat).toBe(false);
    });

    it('should set repeat mode explicitly', () => {
      let result = timer.repeat(true);
      expect(result.repeat).toBe(true);

      result = timer.repeat(false);
      expect(result.repeat).toBe(false);

      result = timer.repeat(true);
      expect(result.repeat).toBe(true);
    });
  });

  describe('next()', () => {
    it('should move to next interval', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const result = timer.next();

      expect(result.interval).toBe(1);
      expect(result.remaining).toBe(5000); // Break interval duration in milliseconds
    });

    it('should wrap around to first interval at end', () => {
      timer.setState(createTimerState({ interval: 2 })); // Last interval

      const result = timer.next();

      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(25000); // Work interval duration in milliseconds
    });

    it('should update timing when running', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(5000);

      const result = timer.next();

      expect(result.startedAt).toBe(mockTime + 5000);
      expect(result.startedInterval).toBe(1);
      expect(result.timePaused).toBe(0);
    });

    it('should handle timing when paused and running', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      timer.pause();
      advanceTime(3000);

      const result = timer.next();

      expect(result.startedAt).toBe(mockTime + 3000);
      expect(result.pausedAt).toBe(mockTime + 3000);
    });

    it('should not update timing when stopped', () => {
      const result = timer.next();

      expect(result.startedAt).toBe(0);
      expect(result.startedInterval).toBe(0);
    });

    it('should handle empty intervals gracefully', () => {
      const emptyTimer = new Timer([]);

      const result = emptyTimer.next();

      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(1500000); // DEFAULT_DURATION in milliseconds
    });
  });

  describe('resume()', () => {
    it('should resume from paused state', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      timer.pause();
      advanceTime(3000);

      const result = timer.resume();

      expect(result.isPaused).toBe(false);
      expect(result.pausedAt).toBe(0);
      expect(result.timePaused).toBe(3000);
    });

    it('should do nothing when not paused', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      const stateBefore = timer.getState();

      const result = timer.resume();

      expect(result.isPaused).toBe(false);
      expect(result.pausedAt).toBe(0);
      expect(result.timePaused).toBe(stateBefore.timePaused);
    });
  });

  describe('sync()', () => {
    it('should return unchanged state when not running', () => {
      const originalState = timer.getState();

      const result = timer.sync();

      expect(result).toEqual(originalState);
    });

    it('should return unchanged state when startedAt is 0', () => {
      timer.setState(createTimerState({ isRunning: true, startedAt: 0 }));
      const originalState = timer.getState();

      const result = timer.sync();

      expect(result).toEqual(originalState);
    });

    it('should return unchanged state with empty intervals', () => {
      const emptyTimer = new Timer([]);
      emptyTimer.setState(createTimerState({ isRunning: true, startedAt: 1000000 }));
      const originalState = emptyTimer.getState();

      const result = emptyTimer.sync();

      expect(result).toEqual(originalState);
    });

    it('should calculate time remaining in current interval', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(10000); // 10 seconds elapsed

      const result = timer.sync();

      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(15000); // 25000 - 10000 milliseconds
    });

    it('should advance to next interval when current is complete', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(25000); // Complete first interval (25 seconds)

      const result = timer.sync();

      expect(result.interval).toBe(1);
      expect(result.remaining).toBe(5000); // Break interval duration in milliseconds
    });

    it('should handle multiple interval transitions', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(32000); // 25s + 5s + 2s into third interval

      const result = timer.sync();

      expect(result.interval).toBe(2);
      expect(result.remaining).toBe(13000); // 15000 - 2000 milliseconds
    });

    it('should stop timer at end when repeat is false', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(45000); // Complete all intervals (25 + 5 + 15)

      const result = timer.sync();

      expect(result.isRunning).toBe(false);
      expect(result.isPaused).toBe(false);
      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(25000); // 25 seconds in milliseconds
      expect(result.startedAt).toBe(0);
      expect(result.startedInterval).toBe(0);
      expect(result.pausedAt).toBe(0);
      expect(result.timePaused).toBe(0);
    });

    it('should wrap around when repeat is enabled', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.repeat(true);
      timer.start();
      advanceTime(47000); // Complete cycle + 2s into first interval

      const result = timer.sync();

      expect(result.isRunning).toBe(true);
      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(23000); // 25000 - 2000 milliseconds
    });

    it('should handle paused timer correctly', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(5000);
      timer.pause();
      advanceTime(3000); // Time while paused

      const result = timer.sync();

      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(20000); // 25000 - 5000 milliseconds (pause time excluded)
    });

    it('should handle accumulated pause time', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(3000);
      timer.pause();
      advanceTime(2000);
      timer.resume();
      advanceTime(4000);
      timer.pause();
      advanceTime(1000);

      const result = timer.sync();

      expect(result.interval).toBe(0);
      expect(result.remaining).toBe(18000); // 25000 - 7000 milliseconds (excluding pause times)
    });

    it('should handle timer started from middle interval', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.setState(createTimerState({ interval: 1, startedInterval: 1 }));
      timer.start();
      advanceTime(3000);

      const result = timer.sync();

      expect(result.interval).toBe(1);
      expect(result.remaining).toBe(2000); // 5000 - 3000 milliseconds
    });
  });

  describe('updateState()', () => {
    it('should update timer state from client data', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const clientState = createTimerState({
        repeat: true,
        interval: 1,
        remaining: 3000, // 3 seconds in milliseconds
        isRunning: true,
        isPaused: false,
      });

      const result = timer.updateState(clientState);

      expect(result.repeat).toBe(true);
      expect(result.interval).toBe(1);
      expect(result.remaining).toBe(3000);
      expect(result.isRunning).toBe(true);
      expect(result.isPaused).toBe(false);
    });

    it('should calculate startedAt from elapsed time', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const clientState = createTimerState({
        interval: 0,
        remaining: 20000, // 5 seconds elapsed from 25000ms
        isRunning: true,
        isPaused: false,
      });

      const result = timer.updateState(clientState);

      expect(result.startedAt).toBe(mockTime - 5000); // Started 5 seconds ago
      expect(result.startedInterval).toBe(0);
      expect(result.timePaused).toBe(0);
    });

    it('should handle stopped timer', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const clientState = createTimerState({
        interval: 1,
        remaining: 5000, // 5 seconds in milliseconds
        isRunning: false,
        isPaused: false,
      });

      const result = timer.updateState(clientState);

      expect(result.startedAt).toBe(0);
      expect(result.isRunning).toBe(false);
    });

    it('should handle paused timer', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const clientState = createTimerState({
        interval: 0,
        remaining: 22000, // 22 seconds in milliseconds
        isRunning: true,
        isPaused: true,
      });

      const result = timer.updateState(clientState);

      expect(result.isPaused).toBe(true);
      expect(result.pausedAt).toBe(mockTime);
      expect(result.timePaused).toBe(0);
    });

    it('should handle missing interval duration', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      const timerWithoutIntervals = new Timer([]);

      const clientState = createTimerState({
        interval: 0,
        remaining: 1400000, // 100 seconds elapsed from 1500000ms
        isRunning: true,
      });

      const result = timerWithoutIntervals.updateState(clientState);

      expect(result.startedAt).toBe(mockTime - 100000); // 1500000 - 1400000 = 100000ms elapsed
    });
  });

  describe('updateIntervals()', () => {
    it('should update intervals and maintain timer state', () => {
      const newIntervals = [
        { name: 'New Work', duration: 30, alert: 'Default', customCSS: '' },
        { name: 'New Break', duration: 10, alert: 'Default', customCSS: '' },
      ];

      timer.updateIntervals(newIntervals);

      expect(timer.intervals).toEqual(newIntervals);
      const state = timer.getState();
      expect(state.remaining).toBe(30000); // Updated to new first interval duration in milliseconds
    });

    it('should reset to first interval when current interval is out of bounds', () => {
      timer.setState(createTimerState({ interval: 5 })); // Out of bounds

      const newIntervals = [{ name: 'Only Interval', duration: 20, alert: 'Default', customCSS: '' }];

      timer.updateIntervals(newIntervals);

      const state = timer.getState();
      expect(state.interval).toBe(0);
      expect(state.remaining).toBe(20000); // 20 seconds in milliseconds
    });

    it('should handle empty intervals array', () => {
      timer.updateIntervals([]);

      const state = timer.getState();
      expect(state.interval).toBe(0);
      expect(state.remaining).toBe(1500000); // DEFAULT_DURATION in milliseconds
    });

    it('should recalculate timing for running timer', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(5000);

      const newIntervals = [{ name: 'Updated Work', duration: 30, alert: 'Default', customCSS: '' }];

      timer.updateIntervals(newIntervals);

      const state = timer.getState();
      expect(state.startedAt).toBe(mockTime);
      expect(state.startedInterval).toBe(0);
      expect(state.timePaused).toBe(0);
      expect(state.pausedAt).toBe(0);
    });

    it('should reset timing for paused timer', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      timer.pause();

      const newIntervals = [{ name: 'Updated Work', duration: 35, alert: 'Default', customCSS: '' }];

      timer.updateIntervals(newIntervals);

      const state = timer.getState();
      expect(state.startedAt).toBe(1000000); // Timer preserves startedAt for paused timers
      expect(state.timePaused).toBe(0);
      expect(state.pausedAt).toBe(1000000); // Timer preserves pausedAt for paused timers
    });

    it('should cap remaining to new interval duration', () => {
      timer.setState(createTimerState({ remaining: 30000, interval: 0 })); // 30 seconds in milliseconds

      const newIntervals = [{ name: 'Short Work', duration: 20, alert: 'Default', customCSS: '' }];

      timer.updateIntervals(newIntervals);

      const state = timer.getState();
      expect(state.remaining).toBe(20000); // 20 seconds in milliseconds
    });

    it('should not cap remaining when new duration is larger', () => {
      timer.setState(createTimerState({ remaining: 15000, interval: 0 })); // 15 seconds in milliseconds

      const newIntervals = [{ name: 'Long Work', duration: 40, alert: 'Default', customCSS: '' }];

      timer.updateIntervals(newIntervals);

      const state = timer.getState();
      expect(state.remaining).toBe(40000); // For stopped timer, remaining is set to new duration
    });
  });

  describe('getState()', () => {
    it('should return a copy of current state', () => {
      const state1 = timer.getState();
      const state2 = timer.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references

      // Modifying returned state should not affect timer
      state1.isRunning = true;
      expect(timer.getState().isRunning).toBe(false);
    });
  });

  describe('setState()', () => {
    it('should merge provided state with current state', () => {
      const newState = createTimerState({
        isRunning: true,
        interval: 2,
        remaining: 10000, // 10 seconds in milliseconds
      });

      timer.setState(newState);
      const result = timer.getState();

      expect(result.isRunning).toBe(true);
      expect(result.interval).toBe(2);
      expect(result.remaining).toBe(10000);
      expect(result.repeat).toBe(false); // Original value preserved
      expect(result.isPaused).toBe(false); // Original value preserved
    });

    it('should handle partial state updates', () => {
      timer.setState(createTimerState({ repeat: true }));

      const result = timer.getState();
      expect(result.repeat).toBe(true);
      expect(result.interval).toBe(0); // Other values unchanged
    });

    it('should handle empty state object', () => {
      const originalState = timer.getState();
      timer.setState(createTimerState({}));

      const result = timer.getState();
      expect(result).toEqual(originalState);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete timer workflow', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      // Start timer
      timer.start();
      expect(timer.getState().isRunning).toBe(true);

      // Run for 10 seconds
      advanceTime(10000);
      let syncResult = timer.sync();
      expect(syncResult.remaining).toBe(15000);

      // Pause for 5 seconds
      timer.pause();
      advanceTime(5000);
      syncResult = timer.sync();
      expect(syncResult.remaining).toBe(15000); // Time unchanged while paused

      // Resume and run to completion
      timer.resume();
      advanceTime(15000); // Complete current interval

      syncResult = timer.sync();
      expect(syncResult.interval).toBe(1); // Moved to break
      expect(syncResult.remaining).toBe(5000);

      // Complete entire cycle
      advanceTime(5000 + 15000); // Break + Long break
      syncResult = timer.sync();
      expect(syncResult.isRunning).toBe(false); // Timer stopped
    });

    it('should handle repeat mode cycle', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.repeat(true);
      timer.start();

      // Complete full cycle and start again
      advanceTime(45000 + 5000); // Full cycle + 5s into next cycle

      const syncResult = timer.sync();
      expect(syncResult.isRunning).toBe(true);
      expect(syncResult.interval).toBe(0);
      expect(syncResult.remaining).toBe(20000); // 25000 - 5000
    });

    it('should handle interval updates during timer operation', () => {
      const mockTime = 1000000;
      setMockTime(mockTime);

      timer.start();
      advanceTime(10000);

      // Update intervals while running
      const newIntervals = [{ name: 'Modified Work', duration: 40, alert: 'Default', customCSS: '' }];
      timer.updateIntervals(newIntervals);

      const syncResult = timer.sync();
      expect(syncResult.interval).toBe(0);
      expect(syncResult.remaining).toBe(30000); // 40000 - 10000
    });
  });
});
