export type OpenTagDaemonConfig = {
  runnerId: string;
  dispatcherUrl: string;
  workspacePath: string;
};

export function loadConfigFromEnv(): OpenTagDaemonConfig {
  return {
    runnerId: process.env.OPENTAG_RUNNER_ID ?? "runner_local",
    dispatcherUrl: process.env.OPENTAG_DISPATCHER_URL ?? "http://localhost:3030",
    workspacePath: process.env.OPENTAG_WORKSPACE_PATH ?? process.cwd()
  };
}
