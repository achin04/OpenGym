import "dotenv/config";
import { prisma } from "@/server/db";
import { runTorontoDryRunImport } from "@/server/importers/toronto/dry-run";

async function main() {
  const summary = await runTorontoDryRunImport({
    trigger: "local-cli",
  });

  console.log("Toronto dry-run import complete");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });