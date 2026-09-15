import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Data access only — no business rules, no authorization (CLAUDE.md §4). */

// --- scope sources ----------------------------------------------------------

/**
 * Teams a staff member is currently responsible for.
 *
 * Rows with `unassignedAt` set are past responsibility and grant nothing —
 * the history stays, the access does not.
 */
export async function findTeamIdsForUser(userId: string): Promise<string[]> {
  const rows = await prisma.staffTeam.findMany({
    where: {
      unassignedAt: null,
      staff: { status: "ACTIVE", person: { userId } },
    },
    select: { teamId: true },
  });
  return rows.map((row) => row.teamId);
}

/** Players a guardian is joined to, plus the caller's own player record. */
export async function findPlayerIdsForUser(userId: string): Promise<string[]> {
  const [children, own] = await prisma.$transaction([
    prisma.playerGuardian.findMany({
      where: { guardian: { person: { userId } } },
      select: { playerId: true },
    }),
    prisma.player.findMany({
      where: { person: { userId } },
      select: { id: true },
    }),
  ]);

  return [
    ...new Set([...children.map((c) => c.playerId), ...own.map((p) => p.id)]),
  ];
}

// --- people -----------------------------------------------------------------

export type PlayerWithPerson = Prisma.PlayerGetPayload<{
  include: {
    person: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        dateOfBirth: true;
        gender: true;
        city: true;
        userId: true;
      };
    };
  };
}>;

const PLAYER_PERSON_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  city: true,
  userId: true,
} as const;

/**
 * A page of players, narrowed **inside the query**.
 *
 * `allowedPlayerIds` of `null` means unrestricted; an empty array means the
 * caller may see nothing and the query returns nothing. Filtering here rather
 * than after the fetch matters: a post-filter still leaks through the total
 * count and through response timing (docs/PERMISSIONS.md §5).
 */
export async function listPlayers(params: {
  skip: number;
  take: number;
  search?: string | undefined;
  status?: string | undefined;
  allowedPlayerIds: readonly string[] | null;
}): Promise<{ items: PlayerWithPerson[]; total: number }> {
  const where: Prisma.PlayerWhereInput = {
    ...(params.allowedPlayerIds === null
      ? {}
      : { id: { in: [...params.allowedPlayerIds] } }),
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.search
      ? {
          OR: [
            { playerCode: { contains: params.search, mode: "insensitive" } },
            {
              person: {
                firstName: { contains: params.search, mode: "insensitive" },
              },
            },
            {
              person: {
                lastName: { contains: params.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.player.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
      include: { person: { select: PLAYER_PERSON_SELECT } },
    }),
    prisma.player.count({ where }),
  ]);

  return { items, total };
}

export function findPlayerById(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: {
      person: true,
      guardians: {
        include: { guardian: { include: { person: true } } },
        orderBy: { isPrimary: "desc" },
      },
    },
  });
}

export function findPlayerByNationalCode(nationalCode: string) {
  return prisma.player.findFirst({
    where: { person: { nationalCode } },
    include: { person: true },
  });
}

export async function nextPlayerCode(seasonYear: number): Promise<string> {
  const prefix = `SEP-${seasonYear}-`;
  const last = await prisma.player.findFirst({
    where: { playerCode: { startsWith: prefix } },
    orderBy: { playerCode: "desc" },
    select: { playerCode: true },
  });

  const sequence = last ? Number(last.playerCode.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export function createPlayerWithPerson(
  person: Prisma.PersonCreateInput,
  player: Omit<Prisma.PlayerCreateInput, "person">,
) {
  return prisma.player.create({
    data: { ...player, person: { create: person } },
    include: { person: true },
  });
}

export function updatePlayer(id: string, data: Prisma.PlayerUpdateInput) {
  return prisma.player.update({
    where: { id },
    data,
    include: { person: true },
  });
}

export function updatePerson(id: string, data: Prisma.PersonUpdateInput) {
  return prisma.person.update({ where: { id }, data });
}

// --- guardians --------------------------------------------------------------

export function findGuardianByNationalCode(nationalCode: string) {
  return prisma.guardian.findFirst({
    where: { person: { nationalCode } },
    include: { person: true },
  });
}

export function createGuardianWithPerson(person: Prisma.PersonCreateInput) {
  return prisma.guardian.create({
    data: { person: { create: person } },
    include: { person: true },
  });
}

export function linkGuardianToPlayer(data: {
  playerId: string;
  guardianId: string;
  relation: Prisma.PlayerGuardianCreateInput["relation"];
  isPrimary: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      // Exactly one primary contact per player.
      await tx.playerGuardian.updateMany({
        where: { playerId: data.playerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return tx.playerGuardian.upsert({
      where: {
        playerId_guardianId: {
          playerId: data.playerId,
          guardianId: data.guardianId,
        },
      },
      update: { relation: data.relation, isPrimary: data.isPrimary },
      create: data,
    });
  });
}

// --- staff ------------------------------------------------------------------

export async function listStaff(params: {
  skip: number;
  take: number;
  allowedTeamIds: readonly string[] | null;
}) {
  const where: Prisma.StaffWhereInput =
    params.allowedTeamIds === null
      ? {}
      : { teams: { some: { teamId: { in: [...params.allowedTeamIds] } } } };

  const [items, total] = await prisma.$transaction([
    prisma.staff.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: "desc" },
      include: {
        person: { select: PLAYER_PERSON_SELECT },
        teams: {
          where: { unassignedAt: null },
          include: { team: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.staff.count({ where }),
  ]);

  return { items, total };
}

export function findStaffById(id: string) {
  return prisma.staff.findUnique({
    where: { id },
    include: {
      person: true,
      teams: {
        where: { unassignedAt: null },
        include: { team: { select: { id: true, name: true } } },
      },
    },
  });
}

export function createStaffWithPerson(person: Prisma.PersonCreateInput) {
  return prisma.staff.create({
    data: { person: { create: person } },
    include: { person: true },
  });
}

export function assignStaffToTeam(data: {
  staffId: string;
  teamId: string;
  role: Prisma.StaffTeamCreateInput["role"];
}) {
  return prisma.staffTeam.upsert({
    where: { staffId_teamId: { staffId: data.staffId, teamId: data.teamId } },
    update: { role: data.role, unassignedAt: null },
    create: data,
  });
}

/** Ends an assignment without deleting it — past responsibility is history. */
export function unassignStaffFromTeam(staffId: string, teamId: string) {
  return prisma.staffTeam.update({
    where: { staffId_teamId: { staffId, teamId } },
    data: { unassignedAt: new Date() },
  });
}
