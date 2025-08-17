/**
 * Jest setup file for test environment configuration
 */
import { jest } from '@jest/globals';

const MOCK_TIME = 1672531200000; // 2023-01-01 00:00:00 UTC

// Enable Jest fake timers for all tests
beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(MOCK_TIME);
});

/**
 * Advances the mock time by the specified milliseconds.
 * @param milliseconds The number of ms to advance.
 * @returns The new mock time.
 */
globalThis.advanceTime = (milliseconds) => {
  const currentTime = Date.now();
  jest.setSystemTime(currentTime + milliseconds);
  jest.advanceTimersByTime(milliseconds);
  return currentTime + milliseconds;
};

/**
 * Sets the mock time to a specific timestamp.
 * @param timestamp The timestamp to set.
 * @returns The new mock time.
 */
globalThis.setMockTime = (timestamp) => {
  jest.setSystemTime(timestamp);
  return timestamp;
};

beforeEach(() => {
  jest.setSystemTime(MOCK_TIME);
  jest.clearAllTimers();
});
