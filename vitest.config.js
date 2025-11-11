import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': path.resolve(process.cwd(), 'src'),
      '@features': path.resolve(process.cwd(), 'src/features'),
      '@shared': path.resolve(process.cwd(), 'src/shared'),
      '@lib': path.resolve(process.cwd(), 'src/lib'),
      '@electron': path.resolve(process.cwd(), 'electron'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'electron/', 'dist/'],
    },
  },
});
