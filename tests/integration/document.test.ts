import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findUserAuthorization } from "@/lib/repositories/role.repository";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions/catalogue";
import type { AuthorizedUser } from "@/lib/permissions";
import * as documents from "@/lib/services/document.service";
import { getStorageProvider } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/limits";

async function authorizedUser(mobile: string): Promise<AuthorizedUser> {
  const account = await prisma.user.findUniqueOrThrow({ where: { mobile } });
  const { roles, permissionKeys } = await findUserAuthorization(account.id);
  const known = new Set<string>(ALL_PERMISSIONS);

  return {
    id: account.id,
    mobile: account.mobile,
    roles,
    permissions: permissionKeys.filter((key): key is Permission =>
      known.has(key),
    ),
  };
}

/** A minimal but genuine PNG header — enough for the signature check. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

let admin: AuthorizedUser;
let coach: AuthorizedUser;
let parent: AuthorizedUser;

let squadPersonId: string;
let squadPlayerId: string;
let outsidePersonId: string;
let ownChildPersonId: string;

const created: string[] = [];

async function upload(
  caller: AuthorizedUser,
  personId: string,
  overrides: Partial<documents.UploadInput> = {},
) {
  const document = await documents.uploadDocument(caller, {
    personId,
    type: "ID_DOCUMENT",
    bytes: PNG,
    declaredContentType: "image/png",
    originalName: "id.png",
    ...overrides,
  });
  created.push(document.id);
  return document;
}

beforeAll(async () => {
  [admin, coach, parent] = await Promise.all([
    authorizedUser("09120000001"),
    authorizedUser("09120000003"),
    authorizedUser("09120000005"),
  ]);

  const season = await prisma.season.findFirstOrThrow({
    where: { status: "ACTIVE" },
  });
  const u14 = await prisma.team.findUniqueOrThrow({
    where: { slug: "football-u14" },
  });
  const u16 = await prisma.team.findUniqueOrThrow({
    where: { slug: "football-u16" },
  });

  const squadMembership = await prisma.teamMembership.findFirstOrThrow({
    where: { teamId: u14.id, seasonId: season.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { player: { select: { id: true, personId: true } } },
  });
  squadPlayerId = squadMembership.player.id;
  squadPersonId = squadMembership.player.personId;

  outsidePersonId = (
    await prisma.teamMembership.findFirstOrThrow({
      where: { teamId: u16.id, seasonId: season.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { player: { select: { personId: true } } },
    })
  ).player.personId;

  ownChildPersonId = (
    await prisma.playerGuardian.findFirstOrThrow({
      where: { guardian: { person: { userId: parent.id } } },
      select: { player: { select: { personId: true } } },
    })
  ).player.personId;
});

afterAll(async () => {
  // The rows *and* the files: a test that left uploads on disk would grow the
  // storage directory on every run (docs/PROJECT_RULES.md §6.1).
  const rows = await prisma.document.findMany({
    where: { id: { in: created } },
    select: { id: true, storageKey: true },
  });

  const storage = getStorageProvider();
  for (const row of rows) {
    await storage.delete(row.storageKey).catch(() => undefined);
  }

  if (created.length > 0) {
    await prisma.document.deleteMany({ where: { id: { in: created } } });
  }
});

describe("uploading", () => {
  it("stores the file and records it", async () => {
    const document = await upload(admin, squadPersonId);

    expect(document.contentType).toBe("image/png");
    expect(document.sizeBytes).toBe(PNG.byteLength);
    expect(document.originalName).toBe("id.png");

    // And the bytes really are on the other side of the provider.
    const bytes = await getStorageProvider().get(document.storageKey);
    expect([...bytes]).toEqual([...PNG]);
  });

  /**
   * The rule the whole storage module is built around: the declared type and
   * the filename are both the uploader's choice.
   */
  it("believes the bytes, not the declared type", async () => {
    const document = await upload(admin, squadPersonId, {
      bytes: PDF,
      declaredContentType: "image/png",
      originalName: "definitely-a-png.png",
    });

    expect(document.contentType).toBe("application/pdf");
    expect(document.storageKey.endsWith(".pdf")).toBe(true);
  });

  it("refuses a file that is not one of the accepted formats", async () => {
    const html = new TextEncoder().encode("<html><script>x</script></html>");

    await expect(
      upload(admin, squadPersonId, { bytes: html }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses an empty file", async () => {
    await expect(
      upload(admin, squadPersonId, { bytes: new Uint8Array([]) }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("refuses one over the size limit before writing anything", async () => {
    const huge = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    huge.set(PNG);

    await expect(
      upload(admin, squadPersonId, { bytes: huge }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("never builds a path out of the uploaded name", async () => {
    const document = await upload(admin, squadPersonId, {
      originalName: "../../../etc/passwd",
    });

    expect(document.originalName).toBe("passwd");
    expect(document.storageKey).toMatch(/^documents\/[0-9a-f]{2}\//);
    expect(document.storageKey).not.toContain("..");
  });

  it("gives every upload its own key", async () => {
    const first = await upload(admin, squadPersonId);
    const second = await upload(admin, squadPersonId);
    expect(first.storageKey).not.toBe(second.storageKey);
  });
});

describe("who may upload and read", () => {
  /**
   * **Paperwork is the office's job.** A coach holds `document:read` and not
   * `document:write`, which is a Phase 3 grant this phase kept deliberately:
   * `MEDICAL` is readable only by a document writer, so widening the write
   * permission to coaches would have handed them every medical file as a side
   * effect.
   *
   * The scope check in the upload path is therefore defence in depth — no
   * role that holds `document:write` is scoped today — and it stays, because
   * the grant is a database row an administrator can change.
   */
  it("refuses a coach uploading at all, even for their own squad", async () => {
    await expect(upload(coach, squadPersonId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lets a coach read their own squad's documents", async () => {
    const document = await upload(admin, squadPersonId);
    const file = await documents.readDocument(coach, document.id);
    expect(file.bytes.byteLength).toBe(PNG.byteLength);
  });

  /**
   * Permission and scope are two checks. A parent reaches their own child —
   * so this is not a scope refusal — and is still refused, because they hold
   * no `document:write`.
   */
  it("refuses a parent uploading for their own child", async () => {
    await expect(upload(parent, ownChildPersonId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuses a coach reading a document of another squad's player", async () => {
    const document = await upload(admin, outsidePersonId);

    await expect(
      documents.readDocument(coach, document.id),
    ).rejects.toMatchObject({ code: "OUT_OF_SCOPE" });
  });

  it("hands the bytes back to someone who may have them", async () => {
    const document = await upload(admin, squadPersonId, { bytes: PDF });
    const file = await documents.readDocument(admin, document.id);

    expect([...file.bytes]).toEqual([...PDF]);
    expect(file.contentType).toBe("application/pdf");
    // A PDF viewer runs scripts, so it is always a download.
    expect(file.inline).toBe(false);
  });

  it("lets an image render in place and never a PDF", async () => {
    const image = await upload(admin, squadPersonId);
    expect((await documents.readDocument(admin, image.id)).inline).toBe(true);
  });
});

describe("medical documents", () => {
  /**
   * The same line `medicalNotes` draws on the player record: a coach may know
   * a player exists and not read their medical file.
   */
  it("are left out of the list for a coach", async () => {
    const medical = await upload(admin, squadPersonId, { type: "MEDICAL" });

    const forAdmin = await documents.listPlayerDocuments(admin, squadPlayerId);
    const forCoach = await documents.listPlayerDocuments(coach, squadPlayerId);

    expect(forAdmin.map((item) => item.id)).toContain(medical.id);
    expect(forCoach.map((item) => item.id)).not.toContain(medical.id);
  });

  /** `NOT_FOUND`, so its existence cannot be learned by probing. */
  it("answer a coach as though they do not exist", async () => {
    const medical = await upload(admin, squadPersonId, { type: "MEDICAL" });

    await expect(
      documents.readDocument(coach, medical.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("are readable by someone who may write documents", async () => {
    const medical = await upload(admin, squadPersonId, { type: "MEDICAL" });
    const file = await documents.readDocument(admin, medical.id);
    expect(file.bytes.byteLength).toBe(PNG.byteLength);
  });
});

describe("archiving", () => {
  it("removes it from the list but keeps the row and the file", async () => {
    const document = await upload(admin, squadPersonId);
    await documents.archiveDocument(admin, document.id);

    const listed = await documents.listPlayerDocuments(admin, squadPlayerId);
    expect(listed.map((item) => item.id)).not.toContain(document.id);

    const row = await prisma.document.findUniqueOrThrow({
      where: { id: document.id },
    });
    expect(row.archivedAt).not.toBeNull();

    // The bytes are still there — archiving is not deletion (CLAUDE.md §2).
    const bytes = await getStorageProvider().get(document.storageKey);
    expect(bytes.byteLength).toBe(PNG.byteLength);
  });

  it("happens once", async () => {
    const document = await upload(admin, squadPersonId);
    await documents.archiveDocument(admin, document.id);

    await expect(
      documents.archiveDocument(admin, document.id),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("stops the file being served", async () => {
    const document = await upload(admin, squadPersonId);
    await documents.archiveDocument(admin, document.id);

    await expect(
      documents.readDocument(admin, document.id),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses someone who may not write documents", async () => {
    const document = await upload(admin, ownChildPersonId);

    await expect(
      documents.archiveDocument(parent, document.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
