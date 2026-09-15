import { pingDatabase } from "@/lib/repositories/health.repository";
import { logger } from "@/lib/logger";

export interface HealthReport {
  status: "ok" | "degraded";
  database: "up" | "down";
  timestamp: string;
}

/**
 * Health of the application and its dependencies.
 * A dead database degrades the report rather than throwing: the endpoint must
 * still answer so an orchestrator can read the reason.
 */
export async function getHealthReport(): Promise<HealthReport> {
  let database: HealthReport["database"] = "up";

  try {
    await pingDatabase();
  } catch (error) {
    database = "down";
    logger.error("database health check failed", {
      error: error instanceof Error ? error : String(error),
    });
  }

  return {
    status: database === "up" ? "ok" : "degraded",
    database,
    timestamp: new Date().toISOString(),
  };
}
