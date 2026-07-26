import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/worktrees/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/store/**'],
      reporter: ['text', 'lcov'],
    },
  },
});
