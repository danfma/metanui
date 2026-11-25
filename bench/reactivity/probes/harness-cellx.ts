// F3: five rounds of the harness's cellx for one framework alone, for profiling (node --cpu-prof).
// Needs the prepared harness (scripts/bench-reactivity.sh prepare). Usage: harness-cellx.ts "<framework name>"
import { cellxbench } from "../../../.cache/js-reactivity-benchmark/packages/core/src/benches/cellxBench";
import { frameworkInfo } from "../../../.cache/js-reactivity-benchmark/packages/core/src/frameworksList";
import type { PerfResult } from "../../../.cache/js-reactivity-benchmark/packages/core/src/util/perfLogging";

const rounds = 5;
const name = process.argv[2] ?? "";
const selected = frameworkInfo.filter((entry) => entry.framework.name === name);

if (selected.length === 0) {
  throw new Error('Usage: harness-cellx.ts "<Alien Signals|Solid 2.0|Metanui>"');
}

function logResult(result: PerfResult): void {
  console.log(`${result.framework} | ${result.test} | ${result.time.toFixed(2)}`);
}

for (let round = 0; round < rounds; round++) {
  await cellxbench(selected, logResult);
}
