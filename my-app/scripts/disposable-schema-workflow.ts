import { spawn } from "node:child_process";
import { config as loadEnvironment } from "dotenv";
import {
  resolveDisposableSchemaTarget,
  runDisposableSchemaApply,
  runDisposableSchemaPlan,
  type WorkflowRunner,
  type WorkflowStage,
} from "@/src/server/operations/disposable-schema-workflow";

loadEnvironment({ path: ".env.local", quiet: true });
loadEnvironment({ quiet: true });

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const runStage: WorkflowRunner = async (stage) => {
  console.log(`\n[${stage.id}]`);
  const { command, args } = stageCommand(stage);

  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(command, args, {
      env: process.env,
      shell: false,
      stdio: ["inherit", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({ output });
      else reject(new Error(`Stage ${stage.id} exited with code ${code ?? "unknown"}`));
    });
  });
};

async function main() {
  const action = process.argv[2];
  if (action !== "plan" && action !== "apply") {
    throw new Error("Choose exactly one disposable schema action: plan or apply");
  }

  const target = resolveDisposableSchemaTarget({
    APP_ENV: process.env.APP_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DRIZZLE_DATABASE_URL: process.env.DRIZZLE_DATABASE_URL,
  });
  console.log("Disposable schema workflow", {
    action,
    environment: target.environment,
    target: target.identity,
  });

  if (action === "plan") {
    await runDisposableSchemaPlan(runStage);
    console.log(
      `\nPlan complete. Review the explanation, then acknowledge ${target.identity} when applying. No schema or storage changes were applied.`,
    );
    return;
  }

  const result = await runDisposableSchemaApply(
    target,
    option("--target"),
    runStage,
  );
  console.log("\nDisposable schema apply complete with zero drift", {
    target: target.identity,
    completedStages: result.completed,
  });
}

function stageCommand(stage: WorkflowStage) {
  if (stage.program === "drizzle") {
    return {
      command: process.execPath,
      args: ["node_modules/drizzle-kit/bin.cjs", ...stage.args],
    };
  }
  return {
    command: process.execPath,
    args: ["node_modules/tsx/dist/cli.mjs", ...stage.args],
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Disposable schema workflow failed");
  process.exitCode = 1;
});
