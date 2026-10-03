import mongoose from "mongoose";

// Lets withTransaction() attach its session to every query made inside it automatically.
// Set here (not in connectMongo) so it's guaranteed on wherever withTransaction is used.
mongoose.set("transactionAsyncLocalStorage", true);

let supportsTransactions: boolean | undefined;

/** Transactions need a replica set or mongos (Atlas always is; a bare local mongod is not). */
async function detectTransactionSupport(): Promise<boolean> {
  if (supportsTransactions !== undefined) return supportsTransactions;
  try {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    supportsTransactions = Boolean(hello.setName) || hello.msg === "isdbgrid";
  } catch {
    supportsTransactions = false;
  }
  if (!supportsTransactions) {
    // eslint-disable-next-line no-console
    console.warn("[db] MongoDB is not a replica set — running multi-step writes without transactions.");
  }
  return supportsTransactions;
}

/**
 * Run `fn` so that all of its Mongoose writes commit together or not at all.
 *
 * Mongoose's `transactionAsyncLocalStorage` (enabled in connectMongo) attaches the session to
 * every model call made inside `fn` automatically, so stores/services need no changes.
 *
 * Rules for `fn`:
 * - Database work only. It may be retried on transient conflicts, so send notifications,
 *   socket events, SMS/emails, etc. AFTER this resolves.
 * - Don't run queries in parallel (`Promise.all`) inside it — a session runs one op at a time.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (!(await detectTransactionSupport())) return fn();
  return mongoose.connection.transaction(() => fn());
}

const RowLockModel =
  mongoose.models.RowLock ??
  mongoose.model("RowLock", new mongoose.Schema({ _id: String, n: Number }, { versionKey: false }), "row_locks");

/**
 * Inside withTransaction(): serialise every transaction that locks the same key.
 * Two concurrent transactions that only INSERT new documents never conflict, so a
 * double-clicked "create" would succeed twice; both touching this lock row makes the
 * second one wait/retry and then see what the first created.
 */
export async function lockKey(key: string): Promise<void> {
  await RowLockModel.updateOne({ _id: key }, { $inc: { n: 1 } }, { upsert: true });
}
