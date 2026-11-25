// F3: bench/micro's per-call loop, runnable on Node (performance.now instead of Bun.nanoseconds).
// Needs the micro variants: (cd bench/micro && bun prepare.ts). Usage: per-call-v8.ts <A|B|C>
import { DependencyGraph as GraphA } from "../../micro/.work/A/metanui/reactive/graph/dependency-graph.ts";
import { ReactiveFlags } from "../../micro/.work/A/metanui/reactive/graph/reactive-flags.ts";
import { Reactivity as ReactivityA } from "../../micro/.work/A/metanui/reactive/index.ts";
import { DependencyGraph as GraphB } from "../../micro/.work/B/metanui/reactive/graph/dependency-graph.ts";
import { Reactivity as ReactivityB } from "../../micro/.work/B/metanui/reactive/index.ts";
import { DependencyGraph as GraphC } from "../../micro/.work/C/metanui/reactive/graph/dependency-graph.ts";
import { Reactivity as ReactivityC } from "../../micro/.work/C/metanui/reactive/index.ts";
import { median } from "../../statistics.ts";

interface Variant {
  readonly reactivity: typeof ReactivityA;
  readonly graph: typeof GraphA;
}

const variants: Record<string, Variant> = {
  A: { reactivity: ReactivityA, graph: GraphA },
  B: { reactivity: ReactivityB as unknown as typeof ReactivityA, graph: GraphB as unknown as typeof GraphA },
  C: { reactivity: ReactivityC as unknown as typeof ReactivityA, graph: GraphC as unknown as typeof GraphA },
};

const callsPerSample = 10_000_000;
const warmupCalls = 1_000_000;
const sampleCount = 7;
const name = process.argv[2] ?? "";
const variant = variants[name];

if (variant === undefined) {
  throw new Error("Usage: per-call-v8.ts <A|B|C>");
}

const { reactivity, graph } = variant;
const source = reactivity.signal(0);
const derived = reactivity.computed(() => source.value);

// The first read links derived to source; marking it pending makes checkDirty walk its one clean dep.
void derived.value;
derived.flags |= ReactiveFlags.Pending;

const derivedDeps = derived.deps!;
const sourceSubs = source.subs!;

function measure(label: string, call: () => unknown): void {
  const samples: number[] = [];

  for (let index = 0; index < warmupCalls; index++) {
    call();
  }

  for (let sample = 0; sample < sampleCount; sample++) {
    const start = performance.now();

    for (let index = 0; index < callsPerSample; index++) {
      call();
    }

    samples.push(((performance.now() - start) * 1e6) / callsPerSample);
  }

  console.log(`${name} ${label}: median ${median(samples).toFixed(2)} ns per call`);
}

measure("checkDirty", () => graph.checkDirty(derivedDeps, derived));
measure("propagate", () => graph.propagate(sourceSubs));
