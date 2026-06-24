#!/usr/bin/env node
import { createEchoExecutor } from "@opentag/runner";
import { Command } from "commander";
import { createDispatcherClient } from "./client.js";
import { loadConfigFromEnv } from "./config.js";
import { runOneDaemonIteration } from "./daemon.js";

const program = new Command();

program
  .name("opentagd")
  .description("OpenTag local daemon")
  .command("run-once")
  .description("Claim and execute one run if available")
  .action(async () => {
    const config = loadConfigFromEnv();
    const didWork = await runOneDaemonIteration({
      runnerId: config.runnerId,
      workspacePath: config.workspacePath,
      executor: createEchoExecutor(),
      client: createDispatcherClient({
        dispatcherUrl: config.dispatcherUrl,
        runnerId: config.runnerId
      })
    });
    console.log(didWork ? "OpenTag run completed" : "No OpenTag run available");
  });

await program.parseAsync(process.argv);
