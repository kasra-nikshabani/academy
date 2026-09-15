import type { RoleKey } from "@/lib/generated/prisma/enums";
import { ALL_PERMISSIONS, type Permission } from "./catalogue";

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  permissions: readonly Permission[];
}

/**
 * Default permissions per role, seeded into `RolePermission`.
 *
 * These are **defaults**, not the law: the mapping lives in the database so an
 * administrator can adjust it later without a deploy. The catalogue of what
 * *can* be granted stays in code.
 *
 * Note what is missing from STAFF and PARENT: nothing here limits a coach to
 * their own teams or a parent to their own children. That is Scope, applied
 * per record in the service layer — a permission is never a licence to reach
 * every row of a resource (docs/PERMISSIONS.md §1).
 */
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: "ADMIN",
    name: "مدیر سیستم",
    description: "دسترسی کامل به تمام بخش‌های سیستم",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "ACADEMY_MANAGER",
    name: "مدیر آکادمی",
    description: "مدیریت عملیاتی آکادمی و تصمیم‌های استعدادیابی",
    permissions: [
      "academy:read",
      "academy:write",
      "player:read",
      "player:write",
      "guardian:read",
      "guardian:write",
      "staff:read",
      "staff:write",
      "enrollment:read",
      "enrollment:write",
      "training:read",
      "training:write",
      "attendance:read",
      "attendance:write",
      "tryout:read",
      "tryout:write",
      "tryout:decide",
      "evaluation:read",
      "evaluation:write",
      "match:read",
      "match:write",
      "performance:read",
      "performance:write",
      "notification:read",
      "notification:send",
      "document:read",
      "document:write",
      "report:read",
      "self:read",
    ],
  },
  {
    key: "STAFF",
    name: "کادر فنی",
    description: "مدیریت تمرین، حضور و غیاب و ارزیابی تیم‌های تحت مسئولیت",
    permissions: [
      "academy:read",
      "player:read",
      "guardian:read",
      "staff:read",
      "training:read",
      "training:write",
      "attendance:read",
      "attendance:write",
      "evaluation:read",
      "evaluation:write",
      "match:read",
      "match:write",
      "performance:read",
      "performance:write",
      "notification:read",
      "document:read",
      "self:read",
    ],
  },
  {
    key: "MAIN_TEAM_PLAYER",
    name: "بازیکن تیم اصلی",
    description: "دسترسی به اطلاعات شخصی، تیم، تمرین و عملکرد خود",
    permissions: [
      "academy:read",
      "player:read",
      "training:read",
      "attendance:read",
      "match:read",
      "performance:read",
      "evaluation:read",
      "notification:read",
      "document:read",
      "self:read",
    ],
  },
  {
    key: "SCHOOL_PLAYER",
    name: "بازیکن مدرسه",
    description: "دسترسی محدودتر به اطلاعات شخصی و تمرین",
    permissions: [
      "academy:read",
      "player:read",
      "training:read",
      "attendance:read",
      "notification:read",
      "document:read",
      "self:read",
    ],
  },
  {
    key: "PARENT",
    name: "ولی",
    description: "مشاهده اطلاعات فرزندان",
    permissions: [
      "academy:read",
      // Not a separate "child" permission — scope is what limits a parent to
      // their own children (see catalogue.ts).
      "player:read",
      "guardian:read",
      "training:read",
      "attendance:read",
      "match:read",
      "performance:read",
      "notification:read",
      "self:read",
    ],
  },
];

export function findRoleDefinition(key: RoleKey): RoleDefinition {
  const definition = ROLE_DEFINITIONS.find((role) => role.key === key);
  if (!definition) throw new Error(`unknown role: ${key}`);
  return definition;
}
