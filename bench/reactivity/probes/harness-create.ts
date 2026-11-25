// F2: 100,000 signals through each harness adapter, alone and inside a root plus cleanup.
// Needs the prepared harness (scripts/bench-reactivity.sh prepare). Usage: harness-create.ts <metanui|solid2|alien>
import { alienFramework } from "../../../.cache/js-reactivity-benchmark/packages/core/src/frameworks/alienSignals";
import { metanuiFramework } from "../../../.cache/js-reactivity-benchmark/packages/core/src/frameworks/metanui";
import { solid2Framework } from "../../../.cache/js-reactivity-benchmark/packages/core/src/frameworks/solid2";
import type { ReactiveFramework } from "../../../.cache/js-reactivity-benchmark/packages/core/src/util/reactiveFramework";
import { formatSampled, sampleMs } from "./sampling.ts";

const count = 100_000;
const kept: unknown[] = new Array(count);
const frameworks: Record<string, ReactiveFramework> = {
  metanui: metanuiFramework,
  solid2: solid2Framework,
  alien: alienFramework,
};

const name = process.argv[2] ?? "";
const framework = frameworks[name];

if (framework === undefined) {
  throw new Error("Usage: harness-create.ts <metanui|solid2|alien>");
}

function createSignals(): void {
  for (let index = 0; index < count; index++) {
    kept[index] = framework.signal(index);
  }
}

console.log(formatSampled(`${name} signal x100k`, sampleMs(15, createSignals)));

const inRoot = sampleMs(15, () => {
  framework.withBuild(createSignals);
  framework.cleanup();
});

console.log(formatSampled(`${name} withBuild + signal x100k + cleanup`, inRoot));
