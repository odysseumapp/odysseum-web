import { defineConfig } from '@playwright/test'
import path from 'node:path'

const serverRoot = path.resolve(process.env.ODYSSEUM_SERVER_ROOT || '../odysseum')
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5082',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // One .NET process serves the API and the installed static UI, as in production.
  webServer: {
    command: 'node tests/server.mjs',
    url: 'http://127.0.0.1:5082/health',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ODYSSEUM_SERVER_ROOT: serverRoot,
      ODYSSEUM_WORKSPACE: path.resolve('.test-data/workspace'),
      ODYSSEUM_WEBUI: path.resolve('.test-data/webui'),
      ODYSSEUM_DEMO: 'false',
      ODYSSEUM_PASSWORD: 'integration-password',
      ODYSSEUM_SCAN_SECONDS: '1',
      ODYSSEUM_KEYS: path.resolve('.test-data/keys'),
      ODYSSEUM_SETTINGS: path.resolve('.test-data/server-settings.json'),
      ASPNETCORE_ENVIRONMENT: 'Production',
    },
  },
})
