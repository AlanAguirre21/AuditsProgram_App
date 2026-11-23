import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let transactionsSupported = false;

export async function connectDb(uri = env.MONGO_URI) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName);
  } catch {
    transactionsSupported = false;
  }
  if (!transactionsSupported) {
    logger.warn('MongoDB is not a replica set: multi-document writes run WITHOUT transactions.');
  }
  logger.info({ db: mongoose.connection.name, transactionsSupported }, 'MongoDB connected');
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export const supportsTransactions = () => transactionsSupported;

/**
 * Runs `fn(session)` inside a transaction when the server supports it.
 * On a standalone server `session` is undefined and the writes are not atomic.
 */
export async function withTransaction(fn) {
  if (!transactionsSupported) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
