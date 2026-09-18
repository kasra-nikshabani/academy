import type { NextRequest } from "next/server";
import { apiHandler, created, okPaginated, parsePagination } from "@/lib/api";
import { readJsonBody } from "@/lib/api/request";
import { requireUser } from "@/lib/auth";
import {
  createAnnouncement,
  listAnnouncements,
} from "@/lib/services/announcement.service";
import {
  announcementQuerySchema,
  createAnnouncementSchema,
} from "@/lib/validation/announcement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — published announcements; drafts only for someone who may send. */
export const GET = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const params = new URL(request.url).searchParams;
  const pagination = parsePagination(params);
  const filters = announcementQuerySchema.parse({
    status: params.get("status") ?? undefined,
  });

  const { items, meta } = await listAnnouncements(caller, pagination, filters);
  return okPaginated(items, meta);
});

/** POST — drafts one. Writing is not sending; see `/publish`. */
export const POST = apiHandler(async (request: NextRequest) => {
  const caller = await requireUser();
  const input = createAnnouncementSchema.parse(await readJsonBody(request));
  return created(await createAnnouncement(caller, input));
});
