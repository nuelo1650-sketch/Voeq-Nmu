import { prisma } from "../src/index";

const apps = await prisma.application.findMany({
  select: { id: true, reference: true, businessName: true, status: true },
  orderBy: { createdAt: "asc" },
});
console.log(JSON.stringify(apps, null, 1));
await prisma.$disconnect();
