import type { Config } from 'jest';
import { createDefaultEsmPreset } from 'ts-jest';

const preset = createDefaultEsmPreset();

export default {
  ...preset,
  testMatch: ['<rootDir>/tests/shared/**/*.test.[jt]s'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/ui/'],
} satisfies Config;
