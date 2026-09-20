import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { env } from "@/lib/env";
import { isValidStorageKey } from "../keys";
import type { PutFileInput, StorageProvider, StoredFile } from "../storage";

/**
 * Files on local disk.
 *
 * The MVP provider. `STORAGE_LOCAL_PATH` is outside the repository and in
 * `.gitignore`, because real players' identity documents must never enter Git
 * (CLAUDE.md §29).
 *
 * ## Two checks before anything touches the filesystem
 *
 * The key is validated against the pattern `buildStorageKey` produces, and the
 * resolved absolute path is checked to be inside the root. The second is
 * belt-and-braces — a key that passes the first cannot escape — and it stays
 * because this is the one module where a mistake writes to an arbitrary path,
 * and the cost of the check is a string comparison.
 */
function storageRoot(): string {
  return resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
}

function resolveKey(key: string): string {
  if (!isValidStorageKey(key)) {
    throw new Error("invalid storage key");
  }

  const root = storageRoot();
  const target = resolve(join(root, key));

  // `resolve` has already collapsed any `..`; this is what catches the case
  // where it collapsed to somewhere else entirely.
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error("storage key escapes the storage root");
  }

  return target;
}

export const localStorageProvider: StorageProvider = {
  async put(input: PutFileInput): Promise<StoredFile> {
    const target = resolveKey(input.key);
    await mkdir(dirname(target), { recursive: true });

    // `wx` — fail rather than overwrite. Keys are random, so a collision means
    // something is wrong, and silently replacing a document would destroy a
    // record (CLAUDE.md §2).
    await writeFile(target, input.body, { flag: "wx" });

    return {
      key: input.key,
      size: input.body.byteLength,
      contentType: input.contentType,
    };
  },

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(resolveKey(key)));
  },

  async delete(key: string): Promise<void> {
    await unlink(resolveKey(key)).catch((error: NodeJS.ErrnoException) => {
      // Already gone is the state the caller wanted.
      if (error.code !== "ENOENT") throw error;
    });
  },

  /**
   * The application's own route, never a filesystem path or a public URL.
   *
   * Every read goes through a handler that checks scope. A document store that
   * hands out a directly fetchable address has no access control at all — and
   * these are children's identity papers.
   */
  async getUrl(key: string): Promise<string> {
    return `/api/v1/documents/by-key/${encodeURIComponent(key)}`;
  },
};
