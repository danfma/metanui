import { existsSync } from "node:fs";
import { join } from "node:path";
import { median } from "../statistics.ts";
import { workRoot } from "./core.ts";

// Usage: bun run.ts [rounds=3] [variants=A,B,C]
// Runs every workload and variant in its own Bun process, `rounds` times interleaved, and prints the
// median of the per-process medians with every round's value, so the spread stays visible.
const rounds = parseRounds(process.argv[2] ?? "3");
const variantNames = (process.argv[3] ?? "A,B,C").split(",");
const workloads = ["deep", "wide", "many"];
const directory = import.meta.dir;

function parseRounds(argument: string): number {
  const parsed = Number(argument);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`rounds must be a positive integer, got "${argument}"`);
  }

  return parsed;
}

for (const variant of variantNames) {
  if (!existsSync(join(workRoot, variant))) {
    throw new Error(`variant ${variant} is not prepared under .work: run \`bun prepare.ts\` first`);
  }
}

interface OpsResult {
  readonly variant: string;
  readonly workload: string;
  readonly medianUs: number;
}

function runOps(variant: string, workload: string): OpsResult {
  const result = Bun.spawnSync(["bun", join(directory, "ops.ts"), variant, workload]);

  if (result.exitCode !== 0) {
    throw new Error(`ops.ts ${variant} ${workload} failed:\n${result.stderr.toString()}`);
  }

  return JSON.parse(result.stdout.toString()) as OpsResult;
}

const results: OpsResult[] = [];

for (let round = 0; round < rounds; round++) {
  for (const workload of workloads) {
    for (const variant of variantNames) {
      results.push(runOps(variant, workload));
    }
  }
}

console.log(`| Workload | ${variantNames.join(" | ")} |`);
console.log(`|---|${variantNames.map(() => "---").join("|")}|`);

for (const workload of workloads) {
  const cells = variantNames.map((variant) => {
    const values = results
      .filter((result) => result.variant === variant && result.workload === workload)
      .map((result) => result.medianUs);

    return `${median(values).toFixed(2)} (${values.map((value) => value.toFixed(2)).join(", ")})`;
  });

  console.log(`| ${workload} | ${cells.join(" | ")} |`);
}
