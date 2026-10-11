/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    modules: { localsConvention: 'camelCaseOnly' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'review/src/**/*.test.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    passWithNoTests: true,
  },
});
