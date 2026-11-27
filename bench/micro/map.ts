import { List } from "metano-runtime/system/collections";
import { median } from "../statistics.ts";
import { variantModulePath } from "./core.ts";

// Usage: bun map.ts [variant=A]
// Keyed `Reactivity.map` (spec 4.8) over 1 000 rows, observed by one effect. Each sample builds a
// fresh map in a root and times three flushes: append 1 000 rows to the empty source (every row
// mapped), swap the second and the second-to-last rows, and remove one row from the middle. Prints
// the median µs of each step over 200 samples, after 50 warm-up samples.
const variant = process.argv[2] ?? "A";
const rowCount = 1000;
const warmupSamples = 50;
const sampleCount = 200;

interface Row {
  readonly id: number;
}

interface ListSignal {
  value: unknown;
}

interface MapApi {
  useScheduler(scheduler: unknown): void;
  flush(): void;
  signal(initialValue: unknown): ListSignal;
  map(source: () => unknown, map: (row: Row) => number): () => { readonly count: number };
  effect(compute: () => number, apply: (value: number) => void): void;
  root<T>(body: (dispose: () => void) => T): T;
}

interface CoreModule {
  readonly Reactivity: MapApi;
  readonly ManualFlushScheduler: new () => unknown;
}

const core = (await import(variantModulePath(variant, "index.ts"))) as CoreModule;
const reactivity = core.Reactivity;

reactivity.useScheduler(new core.ManualFlushScheduler());

const rows: Row[] = Array.from({ length: rowCount }, (_, id) => ({ id }));
const swapped = [...rows];

[swapped[1], swapped[rowCount - 2]] = [swapped[rowCount - 2], swapped[1]];

const removed = swapped.filter((_, index) => index !== rowCount / 2);

function readOnly(items: Row[]): unknown {
  return List.adopt<Row>(items, { fixedSize: true });
}

interface StepTimes {
  readonly append: number;
  readonly swap: number;
  readonly remove: number;
}

function timedFlush(source: ListSignal, items: Row[]): number {
  const start = Bun.nanoseconds();

  source.value = readOnly(items);
  reactivity.flush();

  return (Bun.nanoseconds() - start) / 1000;
}

function sample(): StepTimes {
  let lastCount = -1;

  const [source, dispose] = reactivity.root((disposeRoot) => {
    const list = reactivity.signal(readOnly([]));

    const mapped = reactivity.map(
      () => list.value,
      (row) => row.id,
    );

    reactivity.effect(
      () => mapped().count,
      (count) => {
        lastCount = count;
      },
    );

    return [list, disposeRoot] as const;
  });

  reactivity.flush();

  const times = {
    append: timedFlush(source, rows),
    swap: timedFlush(source, swapped),
    remove: timedFlush(source, removed),
  };

  dispose();
  reactivity.flush();

  if (lastCount !== rowCount - 1) {
    throw new Error(`the effect last saw ${lastCount} rows, expected ${rowCount - 1}`);
  }

  return times;
}

for (let index = 0; index < warmupSamples; index++) {
  sample();
}

const samples = Array.from({ length: sampleCount }, sample);

console.log(
  JSON.stringify({
    variant,
    rows: rowCount,
    appendUs: median(samples.map((times) => times.append)),
    swapUs: median(samples.map((times) => times.swap)),
    removeUs: median(samples.map((times) => times.remove)),
  }),
);
