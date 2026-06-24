import { OpenTagEventSchema, OpenTagRunResultSchema, type OpenTagEvent, type OpenTagRun, type OpenTagRunResult } from "@opentag/core";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { repoBindings, runEvents, runners, runs } from "./schema.js";

export type ClaimedOpenTagRun = {
  run: OpenTagRun;
  event: OpenTagEvent;
};

function nowIso(): string {
  return new Date().toISOString();
}

function runFromRow(row: typeof runs.$inferSelect): OpenTagRun {
  const result = row.resultJson ? OpenTagRunResultSchema.parse(JSON.parse(row.resultJson)) : undefined;
  return {
    id: row.id,
    eventId: row.eventId,
    status: row.status as OpenTagRun["status"],
    assignedRunnerId: row.assignedRunnerId ?? undefined,
    executor: row.executor ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(result ? { result } : {})
  };
}

export function createOpenTagRepository(db: BetterSQLite3Database) {
  return {
    async registerRunner(input: { runnerId: string; name: string }): Promise<void> {
      const createdAt = nowIso();
      await db.insert(runners).values({ runnerId: input.runnerId, name: input.name, createdAt }).onConflictDoNothing();
    },

    async createRepoBinding(input: {
      provider: string;
      owner: string;
      repo: string;
      runnerId: string;
      workspacePath?: string;
    }): Promise<void> {
      await db
        .insert(repoBindings)
        .values({ ...input, workspacePath: input.workspacePath ?? null, createdAt: nowIso() })
        .onConflictDoUpdate({
          target: [repoBindings.provider, repoBindings.owner, repoBindings.repo],
          set: {
            runnerId: input.runnerId,
            workspacePath: input.workspacePath ?? null
          }
        });
    },

    async createRun(input: { id: string; event: OpenTagEvent }): Promise<OpenTagRun> {
      const event = OpenTagEventSchema.parse(input.event);
      const createdAt = nowIso();
      await db.insert(runs).values({
        id: input.id,
        eventId: event.id,
        status: "queued",
        eventJson: JSON.stringify(event),
        createdAt,
        updatedAt: createdAt
      });
      await db.insert(runEvents).values({
        runId: input.id,
        type: "run.created",
        payloadJson: JSON.stringify({ eventId: event.id }),
        createdAt
      });
      return {
        id: input.id,
        eventId: event.id,
        status: "queued",
        createdAt,
        updatedAt: createdAt
      };
    },

    async claimNextRun(input: { runnerId: string; leaseSeconds: number }): Promise<ClaimedOpenTagRun | null> {
      const row = await db.select().from(runs).where(eq(runs.status, "queued")).limit(1).get();
      if (!row) return null;

      const updatedAt = nowIso();
      const leaseExpiresAt = new Date(Date.now() + input.leaseSeconds * 1000).toISOString();
      await db
        .update(runs)
        .set({
          status: "assigned",
          assignedRunnerId: input.runnerId,
          leaseExpiresAt,
          updatedAt
        })
        .where(eq(runs.id, row.id));
      await db.insert(runEvents).values({
        runId: row.id,
        type: "run.claimed",
        payloadJson: JSON.stringify({ runnerId: input.runnerId, leaseExpiresAt }),
        createdAt: updatedAt
      });

      return {
        run: {
          id: row.id,
          eventId: row.eventId,
          status: "assigned",
          assignedRunnerId: input.runnerId,
          executor: row.executor ?? undefined,
          createdAt: row.createdAt,
          updatedAt
        },
        event: OpenTagEventSchema.parse(JSON.parse(row.eventJson))
      };
    },

    async markRunning(input: { runId: string; executor: string }): Promise<void> {
      const updatedAt = nowIso();
      await db.update(runs).set({ status: "running", executor: input.executor, updatedAt }).where(eq(runs.id, input.runId));
      await db.insert(runEvents).values({
        runId: input.runId,
        type: "run.running",
        payloadJson: JSON.stringify({ executor: input.executor }),
        createdAt: updatedAt
      });
    },

    async completeRun(input: { runId: string; result: OpenTagRunResult }): Promise<void> {
      const result = OpenTagRunResultSchema.parse(input.result);
      const updatedAt = nowIso();
      const status = result.conclusion === "success" ? "succeeded" : result.conclusion === "cancelled" ? "cancelled" : "failed";
      await db.update(runs).set({ status, resultJson: JSON.stringify(result), updatedAt }).where(eq(runs.id, input.runId));
      await db.insert(runEvents).values({
        runId: input.runId,
        type: "run.completed",
        payloadJson: JSON.stringify(result),
        createdAt: updatedAt
      });
    },

    async getRun(input: { runId: string }): Promise<ClaimedOpenTagRun | null> {
      const row = await db.select().from(runs).where(eq(runs.id, input.runId)).limit(1).get();
      if (!row) return null;
      return {
        run: runFromRow(row),
        event: OpenTagEventSchema.parse(JSON.parse(row.eventJson))
      };
    }
  };
}
