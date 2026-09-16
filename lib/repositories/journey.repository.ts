import { prisma } from "@/lib/db";
import type { JourneyEventType } from "@/lib/generated/prisma/enums";
import type { PlayerJourneyEvent } from "@/lib/generated/prisma/client";
import { dbOr, type Db } from "./transaction";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

export interface JourneyEventInput {
  playerId: string;
  type: JourneyEventType;
  title: string;
  description?: string | undefined;
  occurredAt?: Date | undefined;
  seasonId?: string | undefined;
  teamId?: string | undefined;
  schoolId?: string | undefined;
  actorId?: string | undefined;
}

/**
 * Appends an event.
 *
 * Takes an optional transaction so the caller can write the event alongside
 * the fact it describes. There is deliberately no update and no delete: the
 * timeline is a record, and a record that can be rewritten records nothing.
 */
export function appendJourneyEvent(
  input: JourneyEventInput,
  tx?: Db,
): Promise<PlayerJourneyEvent> {
  return dbOr(tx).playerJourneyEvent.create({
    data: {
      playerId: input.playerId,
      type: input.type,
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      ...(input.seasonId ? { seasonId: input.seasonId } : {}),
      ...(input.teamId ? { teamId: input.teamId } : {}),
      ...(input.schoolId ? { schoolId: input.schoolId } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
    },
  });
}

export function listJourneyForPlayer(
  playerId: string,
): Promise<PlayerJourneyEvent[]> {
  return prisma.playerJourneyEvent.findMany({
    where: { playerId },
    // Newest first for the timeline; ties broken by insertion order so two
    // events recorded in the same instant still read in the order they
    // happened.
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
}

export function countJourneyEvents(playerId: string): Promise<number> {
  return prisma.playerJourneyEvent.count({ where: { playerId } });
}
