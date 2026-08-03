import "dotenv/config";
import { spawn } from "node:child_process";

const allowedEnvironments = new Set([
  "development",
  "local",
  "test",
  "preproduction",
  "staging",
]);

async function run(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  const environment = process.env.APP_ENV?.trim().toLowerCase();
  if (!environment || !allowedEnvironments.has(environment)) {
    throw new Error("Automated Drizzle bootstrap is limited to disposable non-production environments");
  }
  const node = process.execPath;
  const tsx = "node_modules/tsx/dist/cli.mjs";
  await run(node, [tsx, "scripts/apply-operator-sql.ts", "pre-push"]);
  await run(node, ["node_modules/drizzle-kit/bin.cjs", "push"]);
  await run(node, [tsx, "scripts/apply-operator-sql.ts", "post-push"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
