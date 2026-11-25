// F2/F3: the harness's sBench and cellx for one framework alone in its process.
// Needs the prepared harness (scripts/bench-reactivity.sh prepare). Usage: harness-sbench.ts "<framework name>"
import { cellxbench } from "../../../.cache/js-reactivity-benchmark/packages/core/src/benches/cellxBench";
import { sbench } from "../../../.cache/js-reactivity-benchmark/packages/core/src/benches/sBench";
import { frameworkInfo } from "../../../.cache/js-reactivity-benchmark/packages/core/src/frameworksList";
import type { PerfResult } from "../../../.cache/js-reactivity-benchmark/packages/core/src/util/perfLogging";

const name = process.argv[2] ?? "";
const selected = frameworkInfo.filter((entry) => entry.framework.name === name);

if (selected.length === 0) {
  throw new Error('Usage: harness-sbench.ts "<Alien Signals|Solid 2.0|Metanui>"');
}

function logResult(result: PerfResult): void {
  console.log(`${result.framework} | ${result.test} | ${result.time.toFixed(2)}`);
}

await sbench(selected[0].framework, logResult);
await cellxbench(selected, logResult);
