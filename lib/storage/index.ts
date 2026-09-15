export type { PutFileInput, StorageProvider, StoredFile } from "./storage";

/**
 * Provider resolution lands in Phase 18 (Documents), together with upload
 * validation. The interface is fixed now so nothing is written against a
 * concrete provider in the meantime.
 */
