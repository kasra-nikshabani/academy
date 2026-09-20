import { env } from "@/lib/env";
import { localStorageProvider } from "./providers/local";
import type { StorageProvider } from "./storage";

export type { PutFileInput, StorageProvider, StoredFile } from "./storage";

/**
 * Resolves the configured storage backend.
 *
 * Only the local provider exists today. S3-compatible storage is added here
 * when the club has a bucket — nothing outside this module knows which
 * provider is in use, which is the point of the interface being fixed since
 * Phase 0 (CLAUDE.md §18).
 */
export function getStorageProvider(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case "local":
      return localStorageProvider;
  }
}
