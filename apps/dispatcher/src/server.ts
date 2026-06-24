import { OpenTagEventSchema, OpenTagRunResultSchema } from "@opentag/core";
import { createOpenTagRepository, migrateSchema } from "@opentag/store";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Hono } from "hono";
import { z } from "zod";

const CreateRunnerSchema = z.object({
  runnerId: z.string().min(1),
  name: z.string().min(1)
});

const CreateRunSchema = z.object({
  runId: z.string().min(1),
  event: OpenTagEventSchema
});

const CompleteRunSchema = z.object({
  result: OpenTagRunResultSchema
});

export function createDispatcherApp(input: { databasePath: string }) {
  const sqlite = new Database(input.databasePath);
  migrateSchema(sqlite);
  const repo = createOpenTagRepository(drizzle(sqlite));
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.post("/v1/runners", async (c) => {
    const parsed = CreateRunnerSchema.parse(await c.req.json());
    await repo.registerRunner(parsed);
    return c.json({ ok: true }, 201);
  });

  app.post("/v1/runs", async (c) => {
    const parsed = CreateRunSchema.parse(await c.req.json());
    const run = await repo.createRun({ id: parsed.runId, event: parsed.event });
    return c.json({ run }, 201);
  });

  app.post("/v1/runners/:runnerId/claim", async (c) => {
    const claimed = await repo.claimNextRun({ runnerId: c.req.param("runnerId"), leaseSeconds: 60 });
    if (!claimed) return c.body(null, 204);
    return c.json(claimed, 200);
  });

  app.post("/v1/runs/:runId/running", async (c) => {
    const body = z.object({ executor: z.string().min(1) }).parse(await c.req.json());
    await repo.markRunning({ runId: c.req.param("runId"), executor: body.executor });
    return c.json({ ok: true });
  });

  app.post("/v1/runs/:runId/complete", async (c) => {
    const parsed = CompleteRunSchema.parse(await c.req.json());
    await repo.completeRun({ runId: c.req.param("runId"), result: parsed.result });
    return c.json({ ok: true });
  });

  app.get("/v1/runs/:runId", async (c) => {
    const stored = await repo.getRun({ runId: c.req.param("runId") });
    if (!stored) return c.json({ error: "run_not_found" }, 404);
    return c.json(stored);
  });

  return app;
}
