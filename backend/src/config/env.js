import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3045),
  CLIENT_ORIGINS: z.string().default('http://localhost:5190'),
  APP_BASE_URL: z.string().url().optional(),
  TZ_APP: z.string().default('America/Mexico_City'),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  ALLOWED_EMAIL_DOMAINS: z.string().default(''),

  TEAMS_2FA_WEBHOOK_URL: z.string().optional().default(''),
  TEAMS_2FA_API_TOKEN: z.string().optional().default(''),
  TWO_FACTOR_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  TWO_FACTOR_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // Notifications workflow (reminders, escalations, events, digest; optional email copy).
  TEAMS_NOTIFY_WEBHOOK_URL: z.string().optional().default(''),
  TEAMS_NOTIFY_API_TOKEN: z.string().optional().default(''),

  // Brand logo shown in the Teams cards (PNG/JPG; Teams does not render SVG). Empty = no logo.
  BRAND_LOGO_URL: z.string().trim().url().optional().or(z.literal('')).default(''),

  // Fixed administrator account, enforced on every API start (see src/modules/users/ensureAdmin.js).
  // ADMIN_EMAIL = the account's real email (receives the Teams codes and notifications).
  // ADMIN_USERNAME = optional login alias for that account (e.g. admin@zf.com); it is not a user.
  ADMIN_EMAIL: z.string().trim().toLowerCase().email().optional().or(z.literal('')).default(''),
  ADMIN_USERNAME: z.string().trim().toLowerCase().optional().default(''),
  ADMIN_NAME: z.string().trim().default('Administrador'),
  ADMIN_PASSWORD: z.string().optional().default(''),

  LOCAL_STORAGE_PATH: z.string().default('./storage'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(20),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NOTIFICATIONS_DRY_RUN: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const e = parsed.data;

/**
 * Demo mode (`--demo` on any entry point): same configuration, but a separate database
 * (`<name>_demo`) and evidence folder, so sample data never mixes with real data.
 */
export const DEMO = process.argv.includes('--demo');
export function demoUri(uri) {
  const u = new URL(uri);
  const db = u.pathname.replace(/^\//, '') || 'audits_program';
  u.pathname = `/${db.endsWith('_demo') ? db : `${db}_demo`}`;
  return u.toString();
}
if (DEMO) {
  e.MONGO_URI = demoUri(e.MONGO_URI);
  e.LOCAL_STORAGE_PATH = `${e.LOCAL_STORAGE_PATH.replace(/[\\/]+$/, '')}-demo`;
}

const origins = e.CLIENT_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);

if (e.NODE_ENV === 'production' && process.argv.includes('--demo')) {
  console.error('--demo is not allowed in production.');
  process.exit(1);
}
if (e.NODE_ENV === 'production' && !e.TEAMS_2FA_WEBHOOK_URL) {
  console.error('TEAMS_2FA_WEBHOOK_URL is required in production (2FA codes could not be delivered).');
  process.exit(1);
}

export const env = {
  ...e,
  isDemo: DEMO,
  isProd: e.NODE_ENV === 'production',
  isTest: e.NODE_ENV === 'test',
  corsOrigins: origins,
  appBaseUrl: e.APP_BASE_URL || origins[0] || 'http://localhost:5190',
  allowedEmailDomains: e.ALLOWED_EMAIL_DOMAINS.split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean),
  maxFileSizeBytes: Math.round(e.MAX_FILE_SIZE_MB * 1024 * 1024),
};
