import { seedIllustrativeSession } from "../lib/demo/illustrative";
import { prisma } from "../lib/database/prisma";
import { isHostedDeployment } from "../lib/storage";

if (isHostedDeployment()) {
  console.log("Skipping SHORE-1001 sample seed in hosted/PostgreSQL environment to avoid creating reusable public credentials.");
  process.exit(0);
}

seedIllustrativeSession()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seeded illustrative session SHORE-1001.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
