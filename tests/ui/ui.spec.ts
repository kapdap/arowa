/**
 * Playwright UI tests for AroWā
 *
 * Tests are AI generated and havn't been validated.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000'; // Adjust if server runs on a different port

test.describe('AroWā Collaborative Timer - UI Integration', () => {
  test('Session creation and joining via URL', async ({ page, context }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveURL(/\/[a-z0-9-]{3,64}$/);
    const sessionUrl = page.url();
    const page2 = await context.newPage();
    await page2.goto(sessionUrl);
    await expect(page2).toHaveURL(sessionUrl);
    const timer1 = await page.locator('#timer-text').textContent();
    const timer2 = await page2.locator('#timer-text').textContent();
    expect(timer1).toBe(timer2);
  });

  test('Timer controls: start, pause, stop, next interval', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#start-btn');
    await expect(page.locator('body')).toHaveClass(/timer-running/);
    await page.click('#pause-btn');
    await expect(page.locator('body')).toHaveClass(/timer-paused/);
    await page.click('#stop-btn');
    await expect(page.locator('body')).toHaveClass(/timer-stopped/);
    await page.click('#next-btn');
    // Interval status should update (e.g., 2/2)
    const intervalStatus = await page.locator('#interval-status').textContent();
    expect(intervalStatus).toMatch(/\d+\/\d+/);
  });

  test('Multi-interval support: add and cycle intervals', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#interval-status');
    await expect(page.locator('#intervals-modal')).toBeVisible();
    await page.click('#add-interval-btn');
    const newIntervalInput = page.locator('#intervals-list .interval-name');
    await expect(newIntervalInput.last()).toHaveValue('New Interval');
    // Close only the intervals modal
    await page.click('#intervals-modal .close');
    await page.click('#next-btn');
    const intervalStatus = await page.locator('#interval-status').textContent();
    expect(intervalStatus).toMatch(/\d+\/\d+/);
  });

  test('Repeat mode: enable and verify toggle', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#repeat-btn');
    await expect(page.locator('body')).toHaveClass(/timer-repeat/);
    await page.click('#repeat-btn');
    await expect(page.locator('body')).not.toHaveClass(/timer-repeat/);
  });

  // Needs window.app.share.showShareModal() mock
  /*test('Session sharing: copy URL and QR code', async ({ page }) => {
    await page.goto(BASE_URL);
    // Open modal explicitly
    await page.evaluate(() => window.app.share.showShareModal(window.location.href));
    await expect(page.locator('#share-modal')).toBeVisible();
    await page.click('#share-copy-btn');
    await expect(page.locator('#share-qr-code canvas')).toBeVisible();
  });*/

  test('User profile: open and update', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#user-profile-btn');
    await expect(page.locator('#user-modal')).toBeVisible();
    await page.fill('#user-name-input', 'Test User');
    // Blur to trigger save
    await page.locator('#user-name-input').blur();
    // Modal stays open, but name is saved in local user object
    // Check that the input value is updated
    await expect(page.locator('#user-name-input')).toHaveValue('Test User');
  });

  test('Settings: toggle focus mode, wake lock, audio, repeat', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#settings-btn');
    await expect(page.locator('#settings-modal')).toBeVisible();
    await page.click('#focus-mode-toggle + .toggle-slider');
    await page.click('#audio-toggle + .toggle-slider');
    await page.click('#repeat-toggle + .toggle-slider');
    try {
      await page.click('#wake-lock-toggle + .toggle-slider');
    } catch (e) {}
    await expect(page.locator('#focus-mode-toggle')).toBeChecked();
    await expect(page.locator('#repeat-toggle')).toBeChecked();
    // Do not check #audio-toggle as browser may block programmatic audio enable
  });

  test('Connected users: see and update user list', async ({ page, context }) => {
    await page.goto(BASE_URL);
    await page.click('#connected-users');
    await expect(page.locator('#users-popup')).toBeVisible();
    const page2 = await context.newPage();
    await page2.goto(page.url());
    // Clear storage to force new user (must be on app origin)
    await page2.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page2.reload();
    // Wait for both users to appear (retry for up to 30s)
    await page.reload();
    const usersList = page.locator('#users-list .user-item');
    await expect(usersList).toHaveCount(2, { timeout: 30000 });
  });
});

test.describe('Advanced and Edge-case UI Integration Scenarios', () => {
  test('Change interval while timer is running', async ({ page, context }) => {
    await page.goto(BASE_URL);
    await page.click('#start-btn');
    await expect(page.locator('body')).toHaveClass(/timer-running/);
    const initialInterval = await page.locator('#interval-status').textContent();
    await page.click('#next-btn');
    const newInterval = await page.locator('#interval-status').textContent();
    expect(newInterval).not.toBe(initialInterval);
    // Open another client and check sync
    const page2 = await context.newPage();
    await page2.goto(page.url());
    await expect(page2.locator('#interval-status')).toHaveText(newInterval as string);
  });

  /*test('Modify intervals while timer is running', async ({ page, context }) => {
    await page.goto(BASE_URL);
    await page.click('#start-btn');
    await expect(page.locator('body')).toHaveClass(/timer-running/);
    await page.click('#interval-status');
    await expect(page.locator('#intervals-modal')).toBeVisible();
    // Edit current interval name
    const nameInput = page.locator('#intervals-list .interval-name').first();
    await nameInput.fill('Edited Interval');
    await page.click('#intervals-modal .close');
    // Check update in real time on another client
    const page2 = await context.newPage();
    await page2.goto(page.url());
    await expect(page2.locator('#intervals-list .interval-name').first()).toHaveValue('Edited Interval');
    // Add a new interval
    await page.click('#interval-status');
    await page.click('#add-interval-btn');
    await page.click('#intervals-modal .close');
    await expect(page2.locator('#intervals-list .interval-name')).toHaveCount(2);
    // Delete a interval
    await page.click('#interval-status');
    await page.click('#intervals-list .delete-interval-btn').last();
    await page.click('#intervals-modal .close');
    await expect(page2.locator('#intervals-list .interval-name')).toHaveCount(1);
  });*/

  test('Settings, intervals, and user profile sync in real time', async ({ page, context }) => {
    await page.goto(BASE_URL);
    const page2 = await context.newPage();
    await page2.goto(page.url());
    // Change settings in page1
    await page.click('#settings-btn');
    await page.click('#focus-mode-toggle + .toggle-slider');
    await page.click('#settings-modal .close');
    // Check sync in page2
    await page2.click('#settings-btn');
    await expect(page2.locator('#focus-mode-toggle')).toBeChecked();
    await page2.click('#settings-modal .close');
    // Change user profile in page1
    await page.click('#user-profile-btn');
    await page.fill('#user-name-input', 'Sync User');
    await page.locator('#user-name-input').blur();
    await page.click('#user-modal .close');
    // Check sync in page2
    await page2.click('#user-profile-btn');
    await expect(page2.locator('#user-name-input')).toHaveValue('Sync User');
  });

  test('Timer/server sync logic on join', async ({ page, context }) => {
    await page.goto(BASE_URL);
    await page.click('#start-btn');
    // Wait a second to ensure timer is running
    await page.waitForTimeout(1000);
    const runningTime = await page.locator('#timer-text').textContent();
    // Open a new client and join same session
    const page2 = await context.newPage();
    await page2.goto(page.url());
    // Timer should be running and match (or be close)
    const runningTime2 = await page2.locator('#timer-text').textContent();
    expect(runningTime2).not.toBe('00:00');
    // Pause in page2, check sync in page1
    await page2.click('#pause-btn');
    await expect(page.locator('body')).toHaveClass(/timer-paused/);
  });

  test('Simultaneous edits: intervals/settings', async ({ page, context }) => {
    await page.goto(BASE_URL);
    const page2 = await context.newPage();
    await page2.goto(page.url());
    // Both open intervals modal
    await page.click('#interval-status');
    await page2.click('#interval-status');
    // Both edit interval name
    await page.locator('#intervals-list .interval-name').first().fill('User1 Edit');
    await page2.locator('#intervals-list .interval-name').first().fill('User2 Edit');
    await page.click('#intervals-modal .close');
    await page2.click('#intervals-modal .close');
    // Final state is consistent (either User1 or User2 edit wins, but not both)
    const name1 = await page.locator('#intervals-list .interval-name').first().inputValue();
    const name2 = await page2.locator('#intervals-list .interval-name').first().inputValue();
    expect([name1, name2]).toContain(name1);
    expect(name1).toBe(name2);
  });

  test('Network interruption and reconnect', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('#start-btn');
    // Simulate offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    // Make a change while offline
    await page.click('#pause-btn');
    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(2000);
    // Timer state should be restored and synchronized
    await expect(page.locator('body')).toHaveClass(/timer-paused/);
  });
});
