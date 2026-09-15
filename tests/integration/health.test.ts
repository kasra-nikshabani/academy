import { describe, expect, it } from "vitest";
import { getHealthReport } from "@/lib/services/health.service";

/**
 * Proves the full Phase 0 chain reaches Postgres:
 *   Service → Repository → Prisma (pg adapter) → database
 * Requires the `postgres` service from docker-compose.yml to be running.
 */
describe("health service (integration)", () => {
  it("reports the database as up", async () => {
    const report = await getHealthReport();

    expect(report.database).toBe("up");
    expect(report.status).toBe("ok");
    expect(() => new Date(report.timestamp).toISOString()).not.toThrow();
  });
});
