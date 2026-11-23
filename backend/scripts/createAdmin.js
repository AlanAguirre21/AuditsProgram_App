/**
 * Creates the first ADMIN, or promotes an existing user to ADMIN.
 *
 *   npm run create-admin -- --email ana.lopez@zf.com --name "Ana López" --password "S3gura-2026"
 */
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { ROLE } from '../src/constants/roles.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';
import * as changelog from '../src/modules/changelog/changelog.service.js';
import { User } from '../src/modules/users/user.model.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, password: { type: 'string' } },
});

if (!values.email) {
  console.error('Usage: npm run create-admin -- --email <email> [--name <name> --password <password>]');
  process.exit(1);
}

await connectDb();
const email = values.email.toLowerCase();
let user = await User.findOne({ email });

if (user) {
  if (!user.roles.includes(ROLE.ADMIN)) user.roles = [...new Set([...user.roles, ROLE.ADMIN, ROLE.OWNER])];
  user.isQualitySupervisor = true;
  user.active = true;
  if (values.password) {
    user.passwordHash = await hashPassword(values.password);
    user.passwordChangedAt = new Date();
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  }
  await user.save();
  console.log(`User ${email} is now ADMIN.`);
} else {
  if (!values.name || !values.password || values.password.length < 10) {
    console.error('New user: --name and --password (min 10 characters) are required.');
    process.exit(1);
  }
  user = await User.create({
    email,
    name: values.name,
    roles: [ROLE.ADMIN, ROLE.OWNER],
    isQualitySupervisor: true,
    passwordHash: await hashPassword(values.password),
    passwordChangedAt: new Date(),
  });
  console.log(`ADMIN ${email} created.`);
}
await changelog.record({ entity: 'User', entityId: user._id, action: 'UPDATE', after: { roles: user.roles }, reason: 'createAdmin script', system: true });
await disconnectDb();
