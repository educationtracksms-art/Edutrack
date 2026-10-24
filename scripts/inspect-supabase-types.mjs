import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const file = process.argv[2] ?? "tc2.txt";
const filter = process.argv[3];
const width = Number(process.argv[4] ?? 300);

const t = readFileSync(join(ROOT, file), "utf8").replace(/^\uFEFF/, "");
const lines = t.split(/\r?\n/);
const out = [];
let cur = null;
for (const l of lines) {
  if (/error TS\d+:/.test(l)) {
    if (cur) out.push(cur);
    cur = l.trim();
  } else if (cur && /^\s+\S/.test(l)) {
    cur += " | " + l.trim();
  } else if (cur) {
    out.push(cur);
    cur = null;
  }
}
if (cur) out.push(cur);

const sel = filter ? out.filter((l) => l.includes(filter)) : out;
for (const l of sel) console.log(l.slice(0, width));
console.log(`\n--- ${sel.length} of ${out.length} errors ---`);


