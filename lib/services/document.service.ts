import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  assertWithinScope,
  hasPermission,
  requirePermission,
  resolveScope,
  type AuthorizedUser,
} from "@/lib/permissions";
import * as repo from "@/lib/repositories/document.repository";
import {
  findPersonIdForUser,
  findPersonReach,
  findPlayerById,
} from "@/lib/repositories/people.repository";
import { getStorageProvider } from "@/lib/storage";
import { buildStorageKey, safeDisplayName } from "@/lib/storage/keys";
import {
  ACCEPTED_LABEL,
  claimMatches,
  detectType,
} from "@/lib/storage/signature";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/limits";
import type { DocumentType } from "@/lib/generated/prisma/enums";

/**
 * Documents: the club's paperwork about its people.
 *
 * ## Nothing the uploader says is believed
 *
 * The declared content type and the filename are both chosen by whoever is
 * uploading. The **bytes** decide what the file is
 * (`lib/storage/signature.ts`), this system decides where it goes
 * (`lib/storage/keys.ts`), and the original name is kept only as a label.
 *
 * ## Every read is authorised
 *
 * There is no public URL. A file is fetched through a route that loads the
 * row, resolves the caller's scope and then — and only then — asks storage for
 * the bytes. These are children's identity papers; an address that works
 * without a session is the whole of the access control gone.
 *
 * ## Medical documents are narrower than the rest
 *
 * `MEDICAL` is readable only by someone who may write documents. A coach can
 * see that a consent form exists and cannot open a medical report — the same
 * line `medicalNotes` draws on the player record (docs/PERMISSIONS.md).
 */

export { MAX_UPLOAD_BYTES } from "@/lib/storage/limits";

/** Types only a document writer may open. */
const RESTRICTED_TYPES = new Set<DocumentType>(["MEDICAL"]);

/**
 * Turns the person a document is about into something the caller may reach.
 *
 * Documents hang off a `Person`, but scope is expressed in players and teams.
 * A person who is a player is checked against `scope.playerIds`; a person who
 * is not — a guardian, a staff member — is reachable only by an unscoped
 * caller, because there is no narrower rule that would mean anything.
 */
async function assertMayReachPerson(
  caller: AuthorizedUser,
  personId: string,
): Promise<void> {
  const scope = await resolveScope(caller);
  if (scope.playerIds === null) return;

  const person = await findPersonReach(personId);
  if (!person) throw new NotFoundError("این فرد یافت نشد.");

  // Their own record, whether or not they are a player.
  if (person.userId && person.userId === caller.id) return;

  if (!person.player) {
    // A guardian's or a coach's paperwork is the academy's business, not a
    // scoped caller's.
    throw new NotFoundError("سندی یافت نشد.");
  }

  assertWithinScope(scope.playerIds, person.player.id);
}

/** Whether this caller may open a document of this type. */
function mayReadType(caller: AuthorizedUser, type: DocumentType): boolean {
  if (!RESTRICTED_TYPES.has(type)) return true;
  return hasPermission(caller, "document:write");
}

export async function listPersonDocuments(
  caller: AuthorizedUser,
  personId: string,
  filters: { includeArchived?: boolean | undefined } = {},
) {
  requirePermission(caller, "document:read");
  await assertMayReachPerson(caller, personId);

  const documents = await repo.listForPerson({
    personId,
    includeArchived: filters.includeArchived,
  });

  // A restricted document is filtered out rather than refused: a coach opening
  // a player's record should see the documents they may see, not an error.
  return documents.filter((document) => mayReadType(caller, document.type));
}

/** A player's documents, addressed the way the rest of the system does. */
export async function listPlayerDocuments(
  caller: AuthorizedUser,
  playerId: string,
) {
  requirePermission(caller, "document:read");

  const scope = await resolveScope(caller);
  assertWithinScope(scope.playerIds, playerId);

  const player = await findPlayerById(playerId);
  if (!player) throw new NotFoundError("بازیکن یافت نشد.");

  const documents = await repo.listForPerson({ personId: player.personId });
  return documents.filter((document) => mayReadType(caller, document.type));
}

export interface UploadInput {
  personId: string;
  type: DocumentType;
  bytes: Uint8Array;
  /** What the browser claimed. Checked against the bytes, never trusted. */
  declaredContentType?: string | null | undefined;
  originalName?: string | null | undefined;
  title?: string | undefined;
  notes?: string | undefined;
}

/**
 * Stores a file and records it.
 *
 * The bytes are written **before** the row, and deliberately: a row pointing
 * at a file that was never written is a broken document in the interface,
 * while a file with no row is an orphan on disk that nothing serves. Of the
 * two failures the second is the harmless one.
 *
 * If the row then fails, the file is removed — so the ordinary case leaves
 * nothing behind either.
 */
export async function uploadDocument(
  caller: AuthorizedUser,
  input: UploadInput,
) {
  requirePermission(caller, "document:write");
  await assertMayReachPerson(caller, input.personId);

  if (input.bytes.byteLength === 0) {
    throw new ValidationError("فایل خالی است.");
  }
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `حجم فایل بیش از ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} مگابایت است.`,
    );
  }

  const detected = detectType(input.bytes);
  if (!detected) {
    throw new ValidationError(
      `نوع فایل پشتیبانی نمی‌شود؛ فقط ${ACCEPTED_LABEL} پذیرفته می‌شود.`,
    );
  }

  if (!claimMatches(input.declaredContentType, detected)) {
    // Not a refusal — the bytes already decided — but an honest browser gets
    // this right, so a mismatch is either a broken client or somebody probing.
    logger.warn("upload content type did not match its bytes", {
      declared: input.declaredContentType ?? null,
      detected: detected.contentType,
      actorId: caller.id,
    });
  }

  const storage = getStorageProvider();
  const key = buildStorageKey(detected.extension);

  await storage.put({
    key,
    body: input.bytes,
    contentType: detected.contentType,
  });

  try {
    const document = await repo.createDocument({
      personId: input.personId,
      type: input.type,
      storageKey: key,
      contentType: detected.contentType,
      sizeBytes: input.bytes.byteLength,
      originalName: safeDisplayName(input.originalName),
      title: input.title,
      notes: input.notes,
      uploadedById: caller.id,
    });

    // The shape of the upload, never its contents or the person's name — a
    // document is the kind of record this system exists to protect
    // (CLAUDE.md §27).
    logger.info("document uploaded", {
      documentId: document.id,
      type: document.type,
      bytes: document.sizeBytes,
      actorId: caller.id,
    });

    return document;
  } catch (error) {
    await storage.delete(key).catch(() => {
      // Nothing more to do: the row failed, and a file nothing points at is
      // inert. Logged so a cleanup can find it.
      logger.warn("orphaned upload left in storage", { key });
    });
    throw error;
  }
}

export interface DocumentFile {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
  /** Whether a browser may render it in place — never for a PDF. */
  inline: boolean;
}

/**
 * Reads a document's bytes, having checked that this caller may.
 *
 * The only path to a file. `inline` comes from the stored content type, which
 * came from the bytes at upload — so what the browser is told to do with a
 * file is decided by what the file is, not by what it was called.
 */
export async function readDocument(
  caller: AuthorizedUser,
  id: string,
): Promise<DocumentFile> {
  requirePermission(caller, "document:read");

  const document = await repo.findById(id);
  if (!document) throw new NotFoundError("سندی یافت نشد.");

  await assertMayReachPerson(caller, document.personId);

  if (!mayReadType(caller, document.type)) {
    // `NOT_FOUND`, not `FORBIDDEN`: whether a player has a medical file is
    // itself something a coach should not learn by probing.
    throw new NotFoundError("سندی یافت نشد.");
  }

  if (document.archivedAt) {
    throw new ConflictError("این سند بایگانی شده است.");
  }

  const bytes = await getStorageProvider().get(document.storageKey);

  return {
    bytes,
    contentType: document.contentType,
    filename: document.originalName,
    inline: document.contentType.startsWith("image/"),
  };
}

/** Archives a document. The row and the bytes both stay (CLAUDE.md §2). */
export async function archiveDocument(caller: AuthorizedUser, id: string) {
  requirePermission(caller, "document:write");

  const document = await repo.findById(id);
  if (!document) throw new NotFoundError("سندی یافت نشد.");

  await assertMayReachPerson(caller, document.personId);

  const archived = await repo.archive(id, caller.id);
  if (!archived) {
    throw new ConflictError("این سند پیش از این بایگانی شده است.");
  }

  logger.info("document archived", { documentId: id, actorId: caller.id });
  return repo.findById(id);
}

/** Presentation gating: whether to render the upload form at all. */
export function canUploadDocuments(caller: AuthorizedUser): boolean {
  return hasPermission(caller, "document:write");
}

/** The caller's own person, for the "my documents" view. */
export async function ownPersonId(
  caller: AuthorizedUser,
): Promise<string | null> {
  return findPersonIdForUser(caller.id);
}
