import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
      // Overwritten by the integration setup with a throwaway database.
      MONGO_URI: process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/auditsprogram_test',
      ALLOWED_EMAIL_DOMAINS: 'zf.com',
      LOCAL_STORAGE_PATH: './tests/.storage',
      TEAMS_2FA_WEBHOOK_URL: '',
      TEAMS_NOTIFY_WEBHOOK_URL: '',
      NOTIFICATIONS_DRY_RUN: 'true',
      APP_BASE_URL: 'https://auditorias.test',
      // Never inherit the fixed admin / login alias from the developer's .env.
      ADMIN_EMAIL: '',
      ADMIN_USERNAME: '',
      ADMIN_PASSWORD: '',
    },
  },
});
