// Regenerates src/integrations/supabase/types.ts from supabase/migrations.
// Used when the Supabase CLI is unavailable: parses CREATE TABLE / ALTER TABLE /
// CREATE TYPE statements in migration order and emits the Database type in the
// same shape the Supabase CLI generates.
//
//   node scripts/generate-supabase-types.mjs
//
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const OUT_FILE = join(ROOT, "src", "integrations", "supabase", "types.ts");

const BASE_TYPES = {
  uuid: "string",
  text: "string",
  citext: "string",
  character: "string",
  varchar: "string",
  "character varying": "string",
  name: "string",
  timestamptz: "string",
  "timestamp with time zone": "string",
  "timestamp without time zone": "string",
  timestamp: "string",
  date: "string",
  time: "string",
  "time without time zone": "string",
  interval: "string",
  numeric: "number",
  decimal: "number",
  "double precision": "number",
  real: "number",
  integer: "number",
  int: "number",
  bigint: "number",
  smallint: "number",
  boolean: "boolean",
  bool: "boolean",
  json: "Json",
  jsonb: "Json",
  bytea: "string",
};

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, "");
}

function readBalanced(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

class Schema {
  constructor() {
    this.tables = new Map();
    this.enums = new Map();
  }

  ensureTable(name) {
    if (!this.tables.has(name)) {
      this.tables.set(name, { columns: new Map(), pk: [], uniques: [], fks: [] });
    }
    return this.tables.get(name);
  }

  mapType(sqlType) {
    const t = sqlType
      .trim()
      .replace(/public\./g, "")
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (t.endsWith("[]")) return `${this.mapType(t.slice(0, -2))}[]`;
    if (this.enums.has(t)) return `Database["public"]["Enums"]["${t}"]`;
    if (t.startsWith("numeric(") || t.startsWith("decimal(")) return "number";
    if (t.startsWith("character varying") || t.startsWith("varchar")) return "string";
    if (t.startsWith("timestamp") || t.startsWith("time")) return "string";
    if (BASE_TYPES[t]) return BASE_TYPES[t];
    const first = t.split(" ")[0];
    if (this.enums.has(first)) return `Database["public"]["Enums"]["${first}"]`;
    return "string";
  }

  parseColumnDef(item) {
    const m = item.match(/^([a-z_0-9]+)\s+(.+)$/is);
    if (!m) return null;
    const name = m[1];
    const rest = m[2];
    if (/^(constraint|primary|unique|foreign|check)\b/i.test(name)) return null;

    const typeMatch = rest.match(
      /^(numeric(\([^)]*\))?|decimal(\([^)]*\))?|character(\s+varying)?(\([^)]*\))?|varchar(\([^)]*\))?|timestamptz|timestamp(\s+(with|without)\s+time\s+zone)?|time(\s+(with|without)\s+time\s+zone)?|date|interval|uuid|text|citext|boolean|bool|jsonb?|integer|int|bigint|smallint|real|double\s+precision|bytea|name|[a-z_0-9]+(\[\])?)(\s+with\s+time\s+zone)?/i,
    );
    if (!typeMatch) return null;
    const sqlType = typeMatch[1].replace(/\s+/g, " ").trim();
    const tail = rest.slice(typeMatch[0].length);

    const serial = /^serial$|^bigserial$/i.test(sqlType);
    const notNull = /\bnot\s+null\b/i.test(tail) || serial || /\bprimary\s+key\b/i.test(tail);
    const hasDefault = /\bdefault\b/i.test(tail) || serial;
    const refMatch = tail.match(/references\s+(?:public\.)?([a-z_0-9]+)\s*\(\s*([a-z_0-9]+)\s*\)/i);
    return {
      name,
      sqlType: serial ? "integer" : sqlType,
      notNull,
      hasDefault,
      ref: refMatch ? { table: refMatch[1], column: refMatch[2] } : null,
    };
  }

  applyCreateTable(name, body) {
    const table = this.ensureTable(name);
    for (const item of splitTopLevel(body)) {
      const isTableConstraint =
        /^(constraint|primary|unique|foreign)\b/i.test(item) ||
        /^unique\s*\(/i.test(item) ||
        /^primary\s+key\s*\(/i.test(item);
      if (isTableConstraint) {
        const pk = item.match(/primary\s+key\s*\(([^)]+)\)/i);
        if (pk) table.pk = pk[1].split(",").map((s) => s.trim());
        const uq = item.match(/unique\s*\(([^)]+)\)/i);
        if (uq) table.uniques.push(uq[1].split(",").map((s) => s.trim()));
        const fk = item.match(
          /foreign\s+key\s*\(([^)]+)\)\s*references\s+(?:public\.)?([a-z_0-9]+)\s*\(([^)]+)\)/i,
        );
        if (fk) {
          table.fks.push({
            columns: fk[1].split(",").map((s) => s.trim()),
            refTable: fk[2],
            refColumns: fk[3].split(",").map((s) => s.trim()),
            name: (item.match(/constraint\s+([a-z_0-9]+)/i) || [])[1] || `${name}_fkey`,
          });
        }
        continue;
      }
      const col = this.parseColumnDef(item);
      if (col) {
        if (/^primary\s+key\b/i.test(item)) col.notNull = true;
        table.columns.set(col.name, col);
      }
    }
    // PRIMARY KEY columns are implicitly NOT NULL.
    for (const pkName of table.pk) {
      const col = table.columns.get(pkName);
      if (col) col.notNull = true;
    }
    for (const col of table.columns.values()) {
      if (col.ref && !table.fks.some((f) => f.columns.length === 1 && f.columns[0] === col.name)) {
        table.fks.push({
          columns: [col.name],
          refTable: col.ref.table,
          refColumns: [col.ref.column],
          name: `${name}_${col.name}_fkey`,
        });
      }
    }
  }

  apply(statement) {
    const s = statement.trim();
    let m;

    if (
      (m = s.match(
        /^create\s+type\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s+as\s+enum\s*\(([^)]+)\)/is,
      ))
    ) {
      this.enums.set(m[1], m[2].split(",").map((v) => v.trim().replace(/^'|'$/g, "")));
      return;
    }
    if (
      (m = s.match(
        /^alter\s+type\s+(?:public\.)?([a-z_0-9]+)\s+add\s+value\s+(?:if\s+not\s+exists\s+)?'([^']+)'/is,
      ))
    ) {
      const values = this.enums.get(m[1]) ?? [];
      if (!values.includes(m[2])) values.push(m[2]);
      this.enums.set(m[1], values);
      return;
    }
    if (
      (m = s.match(
        /^create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s*\(/is,
      ))
    ) {
      const body = readBalanced(s, s.indexOf("("));
      this.applyCreateTable(m[1], body.slice(1, -1));
      return;
    }
    if ((m = s.match(/^drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)/is))) {
      this.tables.delete(m[1]);
      return;
    }
    if (
      (m = s.match(
        /^alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s+(.+)$/is,
      ))
    ) {
      this.applyAlter(m[1], m[2]);
      return;
    }
  }

  applyAlter(table, action) {
    let m;
    if (!this.tables.has(table)) {
      if (/add\s+(column|constraint)/i.test(action)) this.ensureTable(table);
      else return;
    }
    const t = this.tables.get(table);

    // Multi-clause ALTER (e.g. ADD COLUMN …, ADD COLUMN …): split on top-level commas.
    if (/^add\s/i.test(action) && splitTopLevel(action).length > 1) {
      for (const clause of splitTopLevel(action)) this.applyAlter(table, clause);
      return;
    }

    if ((m = action.match(/^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?([a-z_0-9]+)\s+(.+)$/is))) {
      if (/^(constraint|primary|unique|foreign|check)\b/i.test(m[1])) {
        const pk = action.match(/primary\s+key\s*\(([^)]+)\)/i);
        if (pk) t.pk = pk[1].split(",").map((s) => s.trim());
        const uq = action.match(/unique\s*\(([^)]+)\)/i);
        if (uq) t.uniques.push(uq[1].split(",").map((s) => s.trim()));
        const fk = action.match(
          /foreign\s+key\s*\(([^)]+)\)\s*references\s+(?:public\.)?([a-z_0-9]+)\s*\(([^)]+)\)/i,
        );
        if (fk) {
          t.fks.push({
            columns: fk[1].split(",").map((s) => s.trim()),
            refTable: fk[2],
            refColumns: fk[3].split(",").map((s) => s.trim()),
            name: (action.match(/constraint\s+([a-z_0-9]+)/i) || [])[1] || `${table}_fkey`,
          });
        }
        return;
      }
      // Rebuild a full "name type …" item so parseColumnDef sees the column name.
      const col = this.parseColumnDef(`${m[1]} ${m[2]}`);
      if (col && !t.columns.has(col.name)) t.columns.set(col.name, col);
      return;
    }
    if ((m = action.match(/^drop\s+(?:column\s+)?(?:if\s+exists\s+)?([a-z_0-9]+)/is))) {
      t.columns.delete(m[1]);
      t.fks = t.fks.filter((f) => !f.columns.includes(m[1]));
      return;
    }
    if ((m = action.match(/^rename\s+column\s+([a-z_0-9]+)\s+to\s+([a-z_0-9]+)/is))) {
      const col = t.columns.get(m[1]);
      if (col) {
        t.columns.delete(m[1]);
        col.name = m[2];
        t.columns.set(m[2], col);
      }
      return;
    }
    if ((m = action.match(/^alter\s+column\s+([a-z_0-9]+)\s+type\s+(.+?)(?:\s+using\s+.+)?$/is))) {
      const col = t.columns.get(m[1]);
      if (col) col.sqlType = m[2].trim().replace(/public\./g, "");
      return;
    }
    if ((m = action.match(/^alter\s+column\s+([a-z_0-9]+)\s+set\s+not\s+null$/is))) {
      const col = t.columns.get(m[1]);
      if (col) col.notNull = true;
      return;
    }
    if ((m = action.match(/^alter\s+column\s+([a-z_0-9]+)\s+drop\s+not\s+null$/is))) {
      const col = t.columns.get(m[1]);
      if (col) col.notNull = false;
      return;
    }
    if ((m = action.match(/^alter\s+column\s+([a-z_0-9]+)\s+(set\s+default\b|drop\s+default)/is))) {
      const col = t.columns.get(m[1]);
      if (col) col.hasDefault = /^set\s+default/i.test(m[2]);
      return;
    }
  }
}

/** Splits migration SQL into statements, respecting $$/​$tag$ dollar-quoted bodies. */
function splitStatements(sql) {
  const clean = stripComments(sql);
  const out = [];
  let current = "";
  let depth = 0;
  let i = 0;
  while (i < clean.length) {
    // Dollar-quoted body ($$…$$ or $tag$…$tag$): copy verbatim, ignore ; and parens inside.
    const dollarMatch = clean.slice(i).match(/^\$[a-z_0-9]*\$/i);
    if (dollarMatch) {
      const tag = dollarMatch[0];
      const end = clean.indexOf(tag, i + tag.length);
      const stop = end === -1 ? clean.length : end + tag.length;
      current += clean.slice(i, stop);
      i = stop;
      continue;
    }
    const ch = clean[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
    i++;
  }
  if (current.trim()) out.push(current);
  return out;
}

// ── Parse all migrations in order ────────────────────────────────────────────
const schema = new Schema();
const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  for (const statement of splitStatements(sql)) {
    try {
      schema.apply(statement);
    } catch (err) {
      console.warn(`[${file}] skipped: ${err.message} :: ${statement.slice(0, 80).trim()}`);
    }
  }
}

// ── Emit types.ts ────────────────────────────────────────────────────────────
const existing = readFileSync(OUT_FILE, "utf8");
const functionsMatch = existing.match(/    Functions: \{[\s\S]*?\r?\n    \};\r?\n/);
if (!functionsMatch) throw new Error("Could not locate Functions section in existing types.ts");
const FUNCTIONS_BLOCK = functionsMatch[0];

const enumsSorted = [...schema.enums.keys()].sort();
const tableNames = [...schema.tables.keys()].sort();
const tsTypeFor = (col) => schema.mapType(col.sqlType);
const sortedCols = (t) => [...t.columns.values()].sort((a, b) => a.name.localeCompare(b.name));

function rowLines(t) {
  return sortedCols(t)
    .map((c) => `          ${c.name}: ${tsTypeFor(c)}${c.notNull ? "" : " | null"};`)
    .join("\n");
}
function insertLines(t) {
  return sortedCols(t)
    .map((c) => {
      if (c.notNull && !c.hasDefault) return `          ${c.name} : ${tsTypeFor(c)};`;
      if (c.notNull) return `          ${c.name}?: ${tsTypeFor(c)};`;
      return `          ${c.name}?: ${tsTypeFor(c)} | null;`;
    })
    .join("\n");
}
function updateLines(t) {
  return sortedCols(t)
    .map((c) => (c.notNull ? `          ${c.name}?: ${tsTypeFor(c)};` : `          ${c.name}?: ${tsTypeFor(c)} | null;`))
    .join("\n");
}
function relationshipsBlock(name, t) {
  if (t.fks.length === 0) return "        Relationships: [];";
  const entries = t.fks.map((fk) => {
    const isOneToOne = t.pk.length > 0 && fk.columns.every((c) => t.pk.includes(c));
    return `          {
            foreignKeyName: "${fk.name}";
            columns: [${fk.columns.map((c) => `"${c}"`).join(", ")}];
            isOneToOne: ${isOneToOne};
            referencedRelation: "${fk.refTable}";
            referencedColumns: [${fk.refColumns.map((c) => `"${c}"`).join(", ")}];
          }`;
  });
  return `        Relationships: [\n${entries.join(",\n")},\n        ];`;
}

const tablesBlock = tableNames
  .map((name) => {
    const t = schema.tables.get(name);
    return `      ${name}: {
        Row: {
${rowLines(t)}
        };
        Insert: {
${insertLines(t)}
        };
        Update: {
${updateLines(t)}
        };
${relationshipsBlock(name, t)}
      };`;
  })
  .join("\n");

const enumsBlock = enumsSorted
  .map((name) => {
    const values = schema.enums.get(name);
    if (values.length === 1) return `      ${name}: "${values[0]}";`;
    return `      ${name}:\n${values.map((v) => `        | "${v}"`).join("\n")};`;
  })
  .join("\n");

const constantsEnums = enumsSorted
  .map((name) => {
    const values = schema.enums.get(name);
    return `      ${name}: [\n${values.map((v) => `        "${v}",`).join("\n")}\n      ],`;
  })
  .join("\n");

const tailStart = existing.indexOf("export type Tables<");
if (tailStart === -1) throw new Error("Could not locate Tables<> helper types");
let tail = existing.slice(tailStart);
tail = tail.replace(
  /export const Constants = \{[\s\S]*?\n\} as const;/,
  `export const Constants = {\n  public: {\n    Enums: {\n${constantsEnums}\n    },\n  },\n} as const;`,
);

const output = `// Regenerated from supabase/migrations by scripts/generate-supabase-types.mjs.
// To refresh after adding migrations, run: node scripts/generate-supabase-types.mjs
// (When the Supabase CLI is available, prefer: supabase gen types typescript)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
${tablesBlock}
    };
    Views: {
      [_ in never]: never;
    };
${FUNCTIONS_BLOCK}    Enums: {
${enumsBlock}
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

${tail}
`;
writeFileSync(OUT_FILE, output);
console.log(`Wrote ${OUT_FILE}`);
console.log(`  tables: ${tableNames.length}`);
console.log(`  enums:  ${enumsSorted.join(", ")}`);


