/**
 * Storage abstraction (CLAUDE.md §18).
 *
 * The MVP writes to local disk, but nothing outside this module may assume
 * that: documents move to S3-compatible object storage later, and only a new
 * provider should be needed.
 */
export interface StoredFile {
  /** Provider-independent key, e.g. `players/2026/abc.pdf`. */
  key: string;
  size: number;
  contentType: string;
}

export interface PutFileInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface StorageProvider {
  put(input: PutFileInput): Promise<StoredFile>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** A URL the browser can fetch; may be short-lived for remote providers. */
  getUrl(key: string): Promise<string>;
}
