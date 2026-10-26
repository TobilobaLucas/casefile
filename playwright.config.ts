import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, retries: 0, timeout: 90_000,
  use: { baseURL: process.env.CASEFILE_TEST_SERVER ?? 'http://127.0.0.1:5275', trace: 'retain-on-failure' },
  webServer: process.env.CASEFILE_TEST_SERVER ? undefined : { command: 'npm run preview -- --port 5275 --strictPort', url: 'http://127.0.0.1:5275', reuseExistingServer: false, timeout: 60_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } } }],
});
