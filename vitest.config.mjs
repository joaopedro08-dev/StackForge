import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      DATABASE_PROVIDER: 'json',
      DATABASE_URL: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});