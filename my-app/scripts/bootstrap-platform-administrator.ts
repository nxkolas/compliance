import "dotenv/config";
import { closeDbConnection } from "@/src/db";
import { grantPlatformAdministrator } from "@/src/server/admin/platform-administrators";
import * as z from "zod";

const inputSchema = z.object({
  userId: z.uuid(),
  reason: z.string().trim().min(1),
});

async function main() {
  const input = inputSchema.parse({
    userId: process.argv[2],
    reason: process.argv.slice(3).join(" "),
  });
  const administrator = await grantPlatformAdministrator({
    ...input,
    actorUserId: null,
    operatorBootstrap: true,
  });
  console.log(`Bootstrapped Platform Administrator ${administrator.userId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
