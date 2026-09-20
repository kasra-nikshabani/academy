import { randomUUID } from "node:crypto";
import { ACCEPTED_EXTENSIONS } from "./signature";

/**
 * Where a file is put, and what its original name is allowed to be.
 *
 * ## The key is generated, never taken from the upload
 *
 * A filename arriving from a browser is attacker-controlled text. Build a path
 * from it and `../../../.env` is a real request; keep the name but sanitise
 * it, and you are one missed character away from the same thing. So the key is
 * a random identifier the server chose, and the name the file arrived with is
 * kept in the database as a **label** — shown to a person, never joined to a
 * path.
 *
 * The extension in the key comes from the **detected** type (see
 * `./signature.ts`), not from the name either.
 *
 * ## Why the key is random rather than the document's id
 *
 * They would work equally well as long as every read goes through the service
 * that checks scope — and that is the rule. But a local provider writes real
 * files into a real directory, and a directory listing of `documents/` whose
 * names are database ids quietly hands out a valid id for every document in
 * the club. A random key costs nothing and says nothing.
 */

/** Two levels of fan-out, so one directory never holds a hundred thousand files. */
export function buildStorageKey(extension: string): string {
  const id = randomUUID();
  return `documents/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.${extension}`;
}

/**
 * Trims an uploaded filename down to something safe to *display*.
 *
 * It is never part of a path. This strips directory separators and control
 * characters anyway, because a label that reads `../../etc/passwd` in the
 * interface is alarming even when it is inert, and because it will eventually
 * be put into a `Content-Disposition` header by someone who has forgotten it
 * came from outside.
 */
export function safeDisplayName(name: string | null | undefined): string {
  if (!name) return "بدون نام";

  const cleaned = name
    // Everything up to the last separator of either kind — a Windows client
    // may send a full path.
    .replace(/^.*[\\/]/, "")
    // Control characters, quotes and the characters a header would choke on.
    .replace(/[\u0000-\u001f\u007f"\\]/g, "")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") return "بدون نام";
  return cleaned.slice(0, 120);
}

/**
 * Refuses a key that did not come from `buildStorageKey`.
 *
 * The provider is the last thing between a string and the filesystem, so it
 * checks rather than assumes — a key reaching it is only ever one this module
 * made, and anything else is a bug worth failing loudly on.
 */
const KEY_PATTERN = new RegExp(
  // The extension comes from the signature list, not a character class. The
  // first version of this allowed any two-to-five letters — which accepted
  // `.exe`, caught by the test that tries exactly that.
  `^documents/[0-9a-f]{2}/[0-9a-f]{2}/[0-9a-f-]{36}\\.(?:${ACCEPTED_EXTENSIONS.join("|")})$`,
);

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}
