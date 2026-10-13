import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { RUN_DIR } from './contract/helpers';

/**
 * Playwright config for the locked widgt contract (spec 02 section 6, spec 03 section 6).
 *
 * It builds the app and serves the production bundle with `vite preview`, so the contract runs
 * against what would ship rather than the dev server. Rendering is pinned (Chromium only,
 * reduced motion, en-GB, Europe/London, device scale factor 1) so screenshots and layout
 * measurements are repeatable between runs.
 *
 * Every output goes under `RUN_DIR`: `REVIEW_RUN_DIR` when set, else `review/runs/latest/`.
 */
const appDir = fileURLToPath(new URL('..', import.meta.url));
const port = 4173;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './contract',
  outputDir: `${RUN_DIR}test-results`,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: `${RUN_DIR}contract-results.json` }]],
  use: {
    baseURL,
    // Not a first-class fixture option, so it goes through the context options.
    contextOptions: { reducedMotion: 'reduce' },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Default viewport. Responsive specs override the width per test with `test.use`.
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    cwd: appDir,
    url: baseURL,
    // Always build fresh: a stale server would score an old bundle.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
