# GitHub To Echo Demo

This demo proves the OpenTag v0 loop without needing a real coding agent.

## Flow

```text
@opentag fix this
-> GitHub Probot ingress
-> hosted dispatcher run
-> opentagd local daemon
-> echo executor
-> final callback text
```

## Local Manual Path

1. Start the dispatcher:

```bash
OPENTAG_DATABASE_PATH=opentag.db pnpm --filter @opentag/dispatcher dev
```

2. Register a runner:

```bash
curl -X POST http://localhost:3030/v1/runners \
  -H 'content-type: application/json' \
  -d '{"runnerId":"runner_local","name":"Local Runner"}'
```

3. Create a run with a normalized event payload:

```bash
curl -X POST http://localhost:3030/v1/runs \
  -H 'content-type: application/json' \
  -d '{
    "runId": "run_demo_1",
    "event": {
      "id": "evt_demo_1",
      "source": "github",
      "sourceEventId": "comment_demo_1",
      "receivedAt": "2026-06-24T00:00:00.000Z",
      "actor": { "provider": "github", "providerUserId": "42", "handle": "octocat" },
      "target": { "mention": "@opentag", "agentId": "opentag" },
      "command": { "rawText": "fix this", "intent": "fix", "args": {} },
      "context": [
        { "kind": "github.issue", "uri": "https://github.com/acme/demo/issues/1", "visibility": "public" }
      ],
      "permissions": [
        { "scope": "issue:comment", "reason": "reply to source thread" }
      ],
      "callback": {
        "provider": "github",
        "uri": "https://api.github.com/repos/acme/demo/issues/1/comments"
      },
      "metadata": { "owner": "acme", "repo": "demo" }
    }
  }'
```

4. Run the daemon once:

```bash
OPENTAG_RUNNER_ID=runner_local \
OPENTAG_DISPATCHER_URL=http://localhost:3030 \
pnpm --filter @opentag/opentagd dev -- run-once
```

5. Inspect the stored run:

```bash
curl http://localhost:3030/v1/runs/run_demo_1
```
