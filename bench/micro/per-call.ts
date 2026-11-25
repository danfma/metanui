import { median } from "../statistics.ts";
import { loadReactivity, variantModulePath } from "./core.ts";

// Usage: bun per-call.ts <variant>
// Calls DependencyGraph.checkDirty and propagate directly on a two-node graph where the walk stops
// at once, so the time is the call overhead. Prints the median ns per call over 7 samples of 10^7 calls.
const [variant] = process.argv.slice(2);
const callsPerSample = 10_000_000;
const warmupCalls = 1_000_000;
const sampleCount = 7;

interface GraphNode {
  flags: number;
  readonly deps: unknown;
  readonly subs: unknown;
}

interface GraphModule {
  readonly DependencyGraph: {
    checkDirty(link: unknown, sub: GraphNode): boolean;
    propagate(link: unknown): void;
  };
}

interface FlagsModule {
  readonly ReactiveFlags: { readonly Pending: number };
}

if (variant === undefined) {
  throw new Error("Usage: bun per-call.ts <variant>");
}

const reactivity = await loadReactivity(variant);
const graph = (await import(variantModulePath(variant, "graph/dependency-graph.ts"))) as GraphModule;
const flags = (await import(variantModulePath(variant, "graph/reactive-flags.ts"))) as FlagsModule;
const source = reactivity.signal(0);
const derived = reactivity.computed(() => source.value);

// The first read links derived to source; marking it pending makes checkDirty walk its one clean dep.
void derived.value;

const sourceNode = source as unknown as GraphNode;
const derivedNode = derived as unknown as GraphNode;

derivedNode.flags |= flags.ReactiveFlags.Pending;

function measure(label: string, call: () => unknown): void {
  const samples: number[] = [];

  for (let index = 0; index < warmupCalls; index++) {
    call();
  }

  for (let sample = 0; sample < sampleCount; sample++) {
    const start = Bun.nanoseconds();

    for (let index = 0; index < callsPerSample; index++) {
      call();
    }

    samples.push((Bun.nanoseconds() - start) / callsPerSample);
  }

  console.log(JSON.stringify({ variant, call: label, medianNs: median(samples) }));
}

measure("checkDirty", () => graph.DependencyGraph.checkDirty(derivedNode.deps, derivedNode));
measure("propagate", () => graph.DependencyGraph.propagate(sourceNode.subs));
