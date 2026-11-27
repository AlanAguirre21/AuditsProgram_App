/**
 * Side-effect module: forces demo mode and dry-run notifications for the process.
 *
 * It must be the FIRST import of any script that needs it. ES modules are evaluated in import
 * order, so this runs before src/config/env.js reads `process.argv` / `process.env` — that is
 * what guarantees the script only ever touches the `<db>_demo` database.
 */
if (!process.argv.includes('--demo')) process.argv.push('--demo');
process.env.NOTIFICATIONS_DRY_RUN = 'true';
