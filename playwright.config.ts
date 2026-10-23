import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// 云端开发环境预装了 Chromium（不要运行 playwright install）；CI 上用 Playwright 自己下载的浏览器
const PREINSTALLED = '/opt/pw-browsers/chromium';
const executablePath = process.env.CI ? undefined : existsSync(PREINSTALLED) ? PREINSTALLED : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
  ],
});
