/**
 * Promote an account to ADMIN so it can open /admin.
 *
 * Usage:  node scripts/set-admin.mjs <collegeId>   (or via tsx for the .ts variant)
 * Example: node scripts/set-admin.mjs 20191234
 *
 * Matches every academic-year row carrying that college ID (the compound key allows one
 * per year) and prints how many were promoted. Idempotent.
 */
import { PrismaClient } from "@prisma/client";

const collegeId = process.argv[2];
if (!collegeId) {
  console.error("Usage: node scripts/set-admin.mjs <collegeId>");
  process.exit(1);
}

const p = new PrismaClient();
const result = await p.user.updateMany({
  where: { collegeId: collegeId.toUpperCase() },
  data: { role: "ADMIN" },
});
console.log(`Promoted ${result.count} account(s) with collegeId ${collegeId.toUpperCase()} to ADMIN.`);
if (result.count === 0) console.log("No matching user — check the ID (register/login uses the same casing).");
await p.$disconnect();
