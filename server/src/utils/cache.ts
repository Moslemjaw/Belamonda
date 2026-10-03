import type { Schema } from "mongoose";

/**
 * In-process read cache for data that rarely changes (offers, clinics, categories).
 * Every entry expires after `ttlMs`, and the whole cache is dropped the moment the model is
 * written anywhere in this process (see watchModel), so admin edits show up immediately.
 */
export class ModelCache<T> {
  private entries = new Map<string, { value: T; at: number; version: number }>();
  private version = 0;

  constructor(private readonly ttlMs: number) {}

  /** Call from schema middleware: any write invalidates every entry. */
  bump() {
    this.version++;
    this.entries.clear();
  }

  async get(key: string, load: () => Promise<T | null>): Promise<T | null> {
    const hit = this.entries.get(key);
    if (hit && hit.version === this.version && Date.now() - hit.at < this.ttlMs) return hit.value;
    const version = this.version;
    const value = await load();
    // Don't cache misses, and don't store a value loaded while a write happened.
    if (value !== null && value !== undefined && version === this.version) {
      this.entries.set(key, { value, at: Date.now(), version });
    }
    return value;
  }
}

/** Invalidate `caches` after any save/update/delete on the schema's model. */
export function watchModel(schema: Schema, ...caches: Array<{ bump: () => void }>) {
  const bumpAll = () => caches.forEach((c) => c.bump());
  schema.post("save", bumpAll);
  schema.post("insertMany", bumpAll);
  for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "findOneAndDelete", "deleteOne", "deleteMany"] as const) {
    schema.post(op, bumpAll);
  }
  schema.post("deleteOne", { document: true, query: false }, bumpAll);
  schema.post("bulkWrite" as any, bumpAll);
}
