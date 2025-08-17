/**
 * Shared constants for timer functionality.
 */

// Timer duration constraints (in seconds)
const MAX_DURATION = 86400; // 24 hours in seconds
const MIN_DURATION = 1;
const DEFAULT_DURATION = 1500; // 25 minutes

// Regular expressions for validation
const SESSION_ID_REGEX = /^[a-z0-9-]{3,64}$/;
const CLIENT_ID_REGEX = /^[a-f0-9-]{36}$/;

// String length constraints
const MAX_STRING_LENGTH = 1000;
const MAX_NAME_LENGTH = 50;
const MAX_URL_LENGTH = 500;

// ES module exports
export {
  SESSION_ID_REGEX,
  CLIENT_ID_REGEX,
  MAX_STRING_LENGTH,
  MAX_NAME_LENGTH,
  MAX_URL_LENGTH,
  MAX_DURATION,
  MIN_DURATION,
  DEFAULT_DURATION,
};
