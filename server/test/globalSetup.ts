import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

/** Start a throwaway single-node replica set (transactions need a replica set). */
export async function setup({ provide }: { provide: (key: string, value: string) => void }) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  provide("mongoUri", replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
