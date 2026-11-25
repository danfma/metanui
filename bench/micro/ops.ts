import { median } from "../statistics.ts";
import { loadReactivity, type ReactivityApi, type ReadableNode } from "./core.ts";

// Usage: bun ops.ts <variant> <deep|wide|many>
// Prints the median µs per op (one write + flush) over 15 samples of 500 ops, after 2000 warm-up ops.
const [variant, workloadName] = process.argv.slice(2);
const graphSize = 1000;
const warmupOps = 2000;
const sampleCount = 15;
const opsPerSample = 500;

type Op = () => number;

/** A chain of computeds read by one effect: one propagate, one checkDirty that descends the chain. */
function deep(reactivity: ReactivityApi): Op {
  const source = reactivity.signal(0);
  let tip: ReadableNode = source;
  let sink = 0;
  let write = 0;

  for (let index = 0; index < graphSize; index++) {
    const previous = tip;

    tip = reactivity.computed(() => previous.value + 1);
  }

  const last = tip;

  reactivity.root(() => {
    reactivity.effect(
      () => last.value,
      (value) => {
        sink += value;
      },
    );
  });

  reactivity.flush();

  return () => {
    source.value = ++write;
    reactivity.flush();

    return sink;
  };
}

/** One signal fanned out to computeds and effects: one wide propagate, many short checkDirty calls. */
function wide(reactivity: ReactivityApi): Op {
  const source = reactivity.signal(0);
  let sink = 0;
  let write = 0;

  reactivity.root(() => {
    for (let index = 0; index < graphSize; index++) {
      const derived = reactivity.computed(() => source.value + index);

      reactivity.effect(
        () => derived.value,
        (value) => {
          sink += value;
        },
      );
    }
  });

  reactivity.flush();

  return () => {
    source.value = ++write;
    reactivity.flush();

    return sink;
  };
}

/** Independent signal → computed → effect chains, all written: many propagate and checkDirty calls. */
function many(reactivity: ReactivityApi): Op {
  let sink = 0;
  let write = 0;

  const sources = reactivity.root(() =>
    Array.from({ length: graphSize }, () => {
      const source = reactivity.signal(0);
      const doubled = reactivity.computed(() => source.value * 2);

      reactivity.effect(
        () => doubled.value,
        (value) => {
          sink += value;
        },
      );

      return source;
    }),
  );

  reactivity.flush();

  return () => {
    write++;

    for (const source of sources) {
      source.value = write;
    }

    reactivity.flush();

    return sink;
  };
}

const workloads: Readonly<Record<string, (reactivity: ReactivityApi) => Op>> = { deep, wide, many };
const workload = workloads[workloadName];

if (variant === undefined || workload === undefined) {
  throw new Error("Usage: bun ops.ts <variant> <deep|wide|many>");
}

const op = workload(await loadReactivity(variant));
const samples: number[] = [];

for (let index = 0; index < warmupOps; index++) {
  op();
}

for (let sample = 0; sample < sampleCount; sample++) {
  const start = Bun.nanoseconds();

  for (let index = 0; index < opsPerSample; index++) {
    op();
  }

  samples.push((Bun.nanoseconds() - start) / opsPerSample / 1000);
}

console.log(JSON.stringify({ variant, workload: workloadName, medianUs: median(samples) }));
