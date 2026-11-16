import { prisma } from "../src/index";

const a = await prisma.application.findFirst({
  where: { reference: "NMU-2026-0001" },
  include: { revisions: { include: { images: true, consents: true } } },
});
console.log("status:", a?.status, "| business:", a?.businessName);
console.log(
  "revisions:",
  a?.revisions.length,
  "| images:",
  a?.revisions[0]?.images.map((i) => `${i.field}:${i.cloudinaryPublicId}`),
  "| consents:",
  a?.revisions[0]?.consents.map((c) => c.type).join(","),
);
const n = await prisma.notification.findFirst({ where: { topic: "application.received" } });
console.log("outbox:", n?.status, "| attempts:", n?.attempts, "| err:", n?.lastError ?? "none");
await prisma.$disconnect();
