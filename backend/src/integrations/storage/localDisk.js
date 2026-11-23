import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Local disk / mounted network share storage.
 * Keys look like `{year}/{occurrenceId}/{uuid}.{ext}`; the original name lives only in the database.
 */
export function createLocalDiskStorage(rootDir) {
  const root = path.resolve(rootDir);

  const resolveKey = (key) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return full;
  };

  return {
    async save(buffer, { year, occurrenceId, ext }) {
      const safeExt = String(ext).toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = [String(year), String(occurrenceId), `${crypto.randomUUID()}.${safeExt}`].join('/');
      const full = resolveKey(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buffer, { flag: 'wx' });
      return key;
    },
    async exists(key) {
      try {
        await fs.access(resolveKey(key));
        return true;
      } catch {
        return false;
      }
    },
    getStream(key) {
      return createReadStream(resolveKey(key));
    },
    async remove(key) {
      await fs.rm(resolveKey(key), { force: true });
    },
  };
}
