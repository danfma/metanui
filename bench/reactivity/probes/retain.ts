// F1: disposed effects stay in the flush queue until the next flush.
// Usage: retain.ts [flush]   (prints the heap after a full GC; needs --expose-gc)
import { Reactivity } from "metanui-reactive/metanui/reactive";

const rounds = 20;
const effectsPerRound = 100_000;
const flushAfterEachRound = process.argv[2] === "flush";

function discardValue(): void {}

function buildAndDispose(count: number): void {
  Reactivity.rootFuncOfActionT((dispose) => {
    const sources = Array.from({ length: count }, (_, index) => Reactivity.signal(index));

    for (const source of sources) {
      Reactivity.effect(() => source.value, discardValue);
    }

    dispose();

    return 0;
  });
}

for (let round = 0; round < rounds; round++) {
  buildAndDispose(effectsPerRound);

  if (flushAfterEachRound) {
    Reactivity.flush();
  }
}

globalThis.gc?.();

const heapMb = (process.memoryUsage().heapUsed / 1e6).toFixed(0);

console.log(`${flushAfterEachRound ? "with flush" : "no flush"}: heapUsed ${heapMb} MB`);
