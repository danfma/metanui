import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { workRoot } from "./core.ts";
import { variants } from "./variants.ts";

// Copies the generated package once per variant and applies the variant to the copy; the
// generated sources under targets/js are only read.
const generatedSource = join(import.meta.dir, "../../targets/js/metanui-reactive/src");

if (!existsSync(join(generatedSource, "metanui/reactive/index.ts"))) {
  throw new Error("Generated package not found: run `dotnet build` at the repository root first.");
}

rmSync(workRoot, { recursive: true, force: true });

for (const [name, variant] of Object.entries(variants)) {
  const root = join(workRoot, name);

  cpSync(generatedSource, root, { recursive: true });
  variant.apply(root);
  console.log(`${name}: ${variant.description}`);
}
