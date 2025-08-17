import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    headless: false,
    viewport: { width: 1280, height: 800 },
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      slowMo: 100,
    },
  },
  testDir: './tests/ui',
  timeout: 60000,
  outputDir: './tests/ui/results',
});
