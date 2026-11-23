import { env } from '../../config/env.js';
import { createLocalDiskStorage } from './localDisk.js';

/**
 * Storage interface used by services: save(buffer, meta) → key, getStream(key), remove(key), exists(key).
 * Swap the implementation (e.g. SharePoint) here without touching services.
 */
export const storage = createLocalDiskStorage(env.LOCAL_STORAGE_PATH);
