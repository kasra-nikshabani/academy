import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { DocumentType } from "@/lib/generated/prisma/enums";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

const DOCUMENT_SELECT = {
  id: true,
  personId: true,
  type: true,
  storageKey: true,
  contentType: true,
  sizeBytes: true,
  originalName: true,
  title: true,
  notes: true,
  uploadedById: true,
  archivedAt: true,
  createdAt: true,
} satisfies Prisma.DocumentSelect;

export function listForPerson(params: {
  personId: string;
  includeArchived?: boolean | undefined;
  type?: DocumentType | undefined;
}) {
  return prisma.document.findMany({
    where: {
      personId: params.personId,
      ...(params.includeArchived ? {} : { archivedAt: null }),
      ...(params.type ? { type: params.type } : {}),
    },
    select: DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export function findById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    select: DOCUMENT_SELECT,
  });
}

/**
 * The row behind a storage key.
 *
 * The key is what a provider URL carries, and this is what turns it back into
 * a record whose owner can be checked. Without it a key would be a bearer
 * token for a file.
 */
export function findByStorageKey(storageKey: string) {
  return prisma.document.findUnique({
    where: { storageKey },
    select: DOCUMENT_SELECT,
  });
}

export function createDocument(
  data: {
    personId: string;
    type: DocumentType;
    storageKey: string;
    contentType: string;
    sizeBytes: number;
    originalName: string;
    title?: string | undefined;
    notes?: string | undefined;
    uploadedById?: string | undefined;
  },
  tx?: Db,
) {
  return dbOr(tx).document.create({
    data: {
      personId: data.personId,
      type: data.type,
      storageKey: data.storageKey,
      contentType: data.contentType,
      sizeBytes: data.sizeBytes,
      originalName: data.originalName,
      ...(data.title === undefined ? {} : { title: data.title }),
      ...(data.notes === undefined ? {} : { notes: data.notes }),
      ...(data.uploadedById === undefined
        ? {}
        : { uploadedById: data.uploadedById }),
    },
    select: DOCUMENT_SELECT,
  });
}

/**
 * Archives a document, and says whether it did.
 *
 * `updateMany` with `archivedAt: null` in the filter, so archiving twice is
 * answered rather than silently re-stamping — the first archival is when it
 * happened, the same reasoning as `readAt` in Phase 15.
 */
export async function archive(
  id: string,
  archivedById: string,
): Promise<boolean> {
  const { count } = await prisma.document.updateMany({
    where: { id, archivedAt: null },
    data: { archivedAt: new Date(), archivedById },
  });
  return count > 0;
}

export function countForPerson(personId: string): Promise<number> {
  return prisma.document.count({ where: { personId, archivedAt: null } });
}

/** Documents attached to a set of people — the player list's badge counts. */
export async function countByPerson(personIds: readonly string[]) {
  if (personIds.length === 0) return new Map<string, number>();

  const rows = await prisma.document.groupBy({
    by: ["personId"],
    where: { personId: { in: [...personIds] }, archivedAt: null },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.personId, row._count._all]));
}
