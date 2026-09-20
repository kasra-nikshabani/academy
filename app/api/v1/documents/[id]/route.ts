import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { archiveDocument, readDocument } from "@/lib/services/document.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/documents/:id — the file itself.
 *
 * The **only** way to the bytes. The row is loaded, the caller's scope is
 * resolved and the type checked, and storage is asked last.
 *
 * Three headers matter as much as the check:
 *
 * - `X-Content-Type-Options: nosniff` stops a browser second-guessing the
 *   type and rendering something as HTML.
 * - `Content-Disposition` is `inline` only for images, which the signature
 *   check has already confirmed really are images. A PDF is always a
 *   download: its viewer runs scripts.
 * - `no-store`, because a child's identity document has no business in a
 *   shared cache.
 */
export const GET = apiHandler(async (_request: Request, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;

  const file = await readDocument(caller, id);
  const disposition = file.inline ? "inline" : "attachment";

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.contentType,
      // The filename is percent-encoded per RFC 5987: it is Persian, and it
      // came from an uploader.
      "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "content-length": String(file.bytes.byteLength),
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
});

/** DELETE — archives it. The row and the bytes stay (CLAUDE.md §2). */
export const DELETE = apiHandler(async (_request: Request, ctx: Context) => {
  const caller = await requireUser();
  const { id } = await ctx.params;
  return ok(await archiveDocument(caller, id));
});
