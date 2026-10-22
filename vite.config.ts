import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

function spaFallback() {
  return {
    name: 'spa-fallback',
    apply: 'build' as const,
    closeBundle() {
      const dist = resolve('dist');
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base: '/SLmanager/',
  plugins: [react(), spaFallback()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
