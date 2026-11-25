// updateSignals broken down: each of sBench's seven update sub-tests, timed exactly as sBench's
// run() times them (3 warm-ups, then the fastest of 10 rounds, cleanup inside the timed region).
// Needs the prepared harness (scripts/bench-reactivity.sh prepare).
// Usage: harness-update.ts "<Alien Signals|Solid 2.0|Metanui>"
import { frameworkInfo } from "../../../.cache/js-reactivity-benchmark/packages/core/src/frameworksList";
import { nextTick } from "../../../.cache/js-reactivity-benchmark/packages/core/src/util/asyncUtil";
import type { ReactiveFramework, Signal } from "../../../.cache/js-reactivity-benchmark/packages/core/src/util/reactiveFramework";

type Update = () => void;
type SubTest = (framework: ReactiveFramework, n: number, sources: Signal<number>[]) => Update;

const COUNT = 1e5;

function batchedWrites(framework: ReactiveFramework, source: Signal<number>, n: number): Update {
  return () => {
    for (let index = 0; index < n; index++) {
      framework.withBatch(() => {
        source.write(index);
      });
    }
  };
}

function effectsOnFirst(framework: ReactiveFramework, sources: Signal<number>[], effects: number): void {
  for (let index = 0; index < effects; index++) {
    framework.effect(() => sources[0].read());
  }
}

const update1to1: SubTest = (framework, n, sources) => {
  effectsOnFirst(framework, sources, 1);

  return batchedWrites(framework, sources[0], n);
};

const update2to1: SubTest = (framework, n, sources) => {
  framework.effect(() => sources[0].read() + sources[1].read());

  return batchedWrites(framework, sources[0], n);
};

const update4to1: SubTest = (framework, n, sources) => {
  framework.effect(() => sources[0].read() + sources[1].read() + sources[2].read() + sources[3].read());

  return batchedWrites(framework, sources[0], n);
};

const update1000to1: SubTest = (framework, n, sources) => {
  framework.effect(() => {
    let sum = 0;

    for (let index = 0; index < 1000; index++) {
      sum += sources[index].read();
    }

    return sum;
  });

  return batchedWrites(framework, sources[0], n);
};

const update1to2: SubTest = (framework, n, sources) => {
  effectsOnFirst(framework, sources, 2);

  return batchedWrites(framework, sources[0], n);
};

const update1to4: SubTest = (framework, n, sources) => {
  effectsOnFirst(framework, sources, 4);

  return batchedWrites(framework, sources[0], n);
};

// sBench writes n / 10 times here.
const update1to1000: SubTest = (framework, n, sources) => {
  effectsOnFirst(framework, sources, 1000);

  return batchedWrites(framework, sources[0], n / 10);
};

const subTests: [string, SubTest, number, number][] = [
  ["update1to1", update1to1, COUNT * 4, 1],
  ["update2to1", update2to1, COUNT * 2, 2],
  ["update4to1", update4to1, COUNT, 4],
  ["update1000to1", update1000to1, COUNT / 250, 1000],
  ["update1to2", update1to2, COUNT, 1],
  ["update1to4", update1to4, COUNT, 1],
  ["update1to1000", update1to1000, COUNT, 1],
];

function createSignals(framework: ReactiveFramework, count: number): Signal<number>[] {
  return Array.from({ length: count }, (_, index) => framework.signal(index));
}

function collectGarbage(): void {
  globalThis.gc?.();
  globalThis.gc?.();
}

async function timeSubTest(framework: ReactiveFramework, subTest: SubTest, n: number, sourceCount: number): Promise<number> {
  collectGarbage();

  for (let round = 0; round < 3; round++) {
    framework.withBuild(() => subTest(framework, n / 100, createSignals(framework, sourceCount)))();
  }

  framework.cleanup();
  collectGarbage();
  await nextTick();

  let fastest = Infinity;

  for (let round = 0; round < 10; round++) {
    let start = 0;

    const update = framework.withBuild(() => {
      const sources = createSignals(framework, sourceCount);

      for (const source of sources) {
        source.read();
        source.read();
        source.read();
      }

      start = performance.now();

      return subTest(framework, n, sources);
    });

    update();
    framework.cleanup();

    const elapsed = performance.now() - start;

    collectGarbage();
    fastest = Math.min(fastest, elapsed);
  }

  return fastest;
}

const name = process.argv[2] ?? "";
const selected = frameworkInfo.find((entry) => entry.framework.name === name);

if (selected === undefined) {
  throw new Error('Usage: harness-update.ts "<Alien Signals|Solid 2.0|Metanui>"');
}

let total = 0;

for (const [label, subTest, n, sourceCount] of subTests) {
  const time = await timeSubTest(selected.framework, subTest, n, sourceCount);

  total += time;
  console.log(`${name} | ${label} | ${time.toFixed(2)}`);
}

console.log(`${name} | updateSignals (sum) | ${total.toFixed(2)}`);
