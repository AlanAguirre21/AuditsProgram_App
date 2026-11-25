/**
 * Administrator accounts.
 *
 * 1) Fixed admin (no arguments): creates or repairs the account defined in .env
 *    (ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD; ADMIN_USERNAME is its login alias).
 *    The API also does this on every start; use this to apply it without restarting.
 *
 *      npm run create-admin
 *
 * 2) Any other user: creates a new ADMIN, or promotes an existing user to ADMIN
 *    (without --password an existing user keeps its password).
 *
 *      npm run create-admin -- --email ana.lopez@zf.com --name "Ana López" --password "S3gura-2026"
 */
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { ensureAdmin } from '../src/modules/users/ensureAdmin.js';
import { User } from '../src/modules/users/user.model.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, password: { type: 'string' }, demo: { type: 'boolean' } },
});

let opts = {};
if (values.email) {
  const email = values.email.toLowerCase().trim();
  if (values.password !== undefined && (values.password.length < 10 || !/[A-Za-z]/.test(values.password) || !/\d/.test(values.password))) {
    console.error('--password must have at least 10 characters, one letter and one number.');
    process.exit(1);
  }
  await connectDb();
  const existing = await User.findOne({ email }).lean();
  if (!existing && (!values.name || !values.password)) {
    console.error('New user: --name and --password are required.');
    await disconnectDb();
    process.exit(1);
  }
  opts = { email, name: values.name ?? existing?.name, password: values.password ?? null };
} else {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or pass --email <email> [--name --password].');
    process.exit(1);
  }
  await connectDb();
}

const { user, changes } = await ensureAdmin(opts);
const alias = !values.email && env.ADMIN_USERNAME ? ` (login: ${env.ADMIN_USERNAME})` : '';
console.log(`ADMIN ${user.email}${alias}: ${changes.length ? changes.join(', ') : 'already up to date'}.`);
await disconnectDb();
