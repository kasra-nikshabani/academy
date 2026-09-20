import type { NextRequest } from "next/server";
import { apiHandler, created } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ValidationError } from "@/lib/errors";
import { uploadDocument } from "@/lib/services/document.service";
import { uploadDocumentSchema } from "@/lib/validation/document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/documents — uploads a file.
 *
 * `multipart/form-data`, because this is the one endpoint that carries bytes.
 * The metadata fields are validated by Zod as everywhere else; the file is
 * validated by its **content** in the service, since a declared type and a
 * filename are both things the uploader chose.
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();

  const form = await request.formData().catch(() => null);
  if (!form) throw new ValidationError("درخواست نامعتبر است.");

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError("فایلی ارسال نشده است.");
  }

  const input = uploadDocumentSchema.parse({
    personId: form.get("personId") ?? undefined,
    type: form.get("type") ?? undefined,
    ...(form.get("title") ? { title: form.get("title") } : {}),
    ...(form.get("notes") ? { notes: form.get("notes") } : {}),
  });

  const document = await uploadDocument(caller, {
    ...input,
    bytes: new Uint8Array(await file.arrayBuffer()),
    declaredContentType: file.type,
    originalName: file.name,
  });

  return created(document);
});
