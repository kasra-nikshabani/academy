/**
 * `shadcn add` writes `import { cn } from "cn"`, pulling in a micro-package for
 * four lines of code. The project keeps `cn` locally in lib/utils, so every
 * freshly added component is rewritten to the local import.
 *
 * Run after `pnpm dlx shadcn@<version> add <component>`:
 *   pnpm ui:fix
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const UI_DIR = "components/ui";
const FROM = /import\s*{\s*cn\s*}\s*from\s*["']cn["'];?/g;
const TO = 'import { cn } from "@/lib/utils";';

const files = await readdir(UI_DIR);
let changed = 0;

for (const file of files) {
  if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;

  const path = join(UI_DIR, file);
  const source = await readFile(path, "utf8");
  if (!FROM.test(source)) continue;

  FROM.lastIndex = 0;
  await writeFile(path, source.replace(FROM, TO), "utf8");
  changed++;
}

console.log(
  changed === 0
    ? "components/ui: imports already normalized"
    : `components/ui: normalized ${changed} file(s)`,
);
