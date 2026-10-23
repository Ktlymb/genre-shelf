import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function gitCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: {
    __BUILD_INFO__: JSON.stringify({
      version: pkg.version,
      time: new Date().toISOString(),
      commit: gitCommit(),
    }),
  },
  build: {
    // 入口文件名即产物名：dist/genre-shelf.html
    rolldownOptions: { input: 'genre-shelf.html' },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
