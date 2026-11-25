import { afterEach, expect, test } from "bun:test";
import {
  type IFlushScheduler,
  ManualFlushScheduler,
  Reactivity,
} from "metanui-reactive/metanui/reactive";

/** The web adapter of spec 4.7, kept test-local: the core ships no platform scheduler. */
const microtaskScheduler: IFlushScheduler = {
  schedule(flush: () => void): void {
    queueMicrotask(flush);
  },
};

const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }

  Reactivity.useScheduler(new ManualFlushScheduler());
  Reactivity.flush();
});

test("a write flushes on the next microtask", async () => {
  Reactivity.useScheduler(microtaskScheduler);

  const count = Reactivity.signal(0);
  const applied: number[] = [];

  const dispose = Reactivity.root((disposeRoot: () => void) => {
    Reactivity.effect(
      () => count.value,
      (value: number) => {
        applied.push(value);
      },
    );

    return disposeRoot;
  });

  disposers.push(dispose);
  await Promise.resolve();
  applied.length = 0;

  count.value = 1;

  expect(applied.length).toBe(0);

  // Microtasks run in FIFO order and the flush runs to completion, so the flush the write queued
  // has run every compute and apply before this await resumes: one turn is enough.
  await Promise.resolve();

  expect(applied).toEqual([1]);
});
