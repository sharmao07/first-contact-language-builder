import { seedIllustrativeSession } from "../lib/demo/illustrative";
import { prisma } from "../lib/database/prisma";

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
