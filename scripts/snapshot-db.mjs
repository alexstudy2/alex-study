/**
 * Full-database snapshot for pre-migration safety (REMEDIATION_PLAN Phase 2 gate).
 *
 * Free-tier Supabase has no dashboard backups, so this is the safety net: every model in
 * schema.prisma is dumped to one JSON file under backups/ (gitignored -- the dump contains
 * PII). Restore story is manual by design; if you ever need it, rows map 1:1 back through
 * a Prisma createMany per table in dependency order.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(process.cwd(), "backups");
const file = join(dir, `snapshot-${stamp}.json`);

mkdirSync(dir, { recursive: true });

// Model names straight from the schema -- avoids depending on dmmf export shape.
const models = [
  ...readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8").matchAll(
    /^model\s+(\w+)/gm,
  ),
].map((m) => m[1]);
const tables = {};
let totalRows = 0;

for (const name of models) {
  const delegate = p[name.charAt(0).toLowerCase() + name.slice(1)];
  const rows = await delegate.findMany();
  tables[name] = rows;
  totalRows += rows.length;
  console.log(`${name}: ${rows.length}`);
}

// BigInt does not survive JSON.stringify; none is expected, but a silent throw mid-write
// would be worse than a widened number.
writeFileSync(
  file,
  JSON.stringify({ exportedAt: new Date().toISOString(), totalRows, tables }, (_, v) =>
    typeof v === "bigint" ? Number(v) : v,
  ),
);

console.log(`\nWROTE ${file}`);
console.log(`MODELS: ${models.length}  ROWS: ${totalRows}  BYTES: ${JSON.stringify(tables).length}`);
await p.$disconnect();
