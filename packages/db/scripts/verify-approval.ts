import { prisma } from "../src/index";

const a = await prisma.application.findUnique({
  where: { reference: "NMU-2026-0002" },
  include: { decisions: true },
});
console.log("status:", a?.status, "| decisions:", a?.decisions.map((d) => `${d.kind} by ${d.decidedByEmail}`));
const n = await prisma.notification.findFirst({ where: { topic: "application.approve" }, orderBy: { createdAt: "desc" } });
console.log("letter #3 outbox:", n?.status, "| attempts:", n?.attempts, "| err:", n?.lastError ?? "none");
await prisma.$disconnect();
