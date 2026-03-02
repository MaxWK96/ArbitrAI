import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: { postcss: { plugins: [] } },  // isolate from global postcss.config.js
  test: {
    globals: true,
  },
});
