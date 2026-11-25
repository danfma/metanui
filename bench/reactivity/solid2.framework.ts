// Adapter for milomg/js-reactivity-benchmark: copied into the harness's `frameworks/` by
// scripts/bench-reactivity.sh, so the `../util` import resolves there, not here.
// It mirrors metanui.framework.ts call for call, so both pay the same adapter cost.
import { createEffect, createMemo, createRoot, createSignal, flush } from "@solidjs/signals";
import type { ReactiveFramework } from "../util/reactiveFramework";

// One disposer per `withBuild`: the harness may build several roots before one `cleanup`.
const rootDisposers: (() => void)[] = [];

function discardValue(): void {}

export const solid2Framework: ReactiveFramework = {
  name: "Solid 2.0",

  signal: <T>(initialValue: T) => {
    // The harness only writes plain values, never functions, so the setter never sees an updater.
    const [read, write] = createSignal(initialValue as Exclude<T, Function>);

    return {
      read: () => read(),

      write: (value: T) => {
        write(value as Exclude<T, Function>);
      },
    };
  },

  computed: (compute) => {
    const read = createMemo(compute);

    return { read: () => read() };
  },

  effect: (run) => {
    createEffect(() => {
      run();

      return 0;
    }, discardValue);
  },

  // Writes are deferred until `flush()`, so a batch is the writes followed by one flush.
  withBatch: (writes) => {
    writes();
    flush();
  },

  withBuild: (build) =>
    createRoot((dispose) => {
      rootDisposers.push(dispose);

      return build();
    }),

  // Mirrors the Metanui adapter, which needs this flush to drain the effects queued by the disposed
  // roots. Solid 2.0 would also flush on its own microtask before the next harness tick.
  cleanup: () => {
    for (const dispose of rootDisposers.splice(0)) {
      dispose();
    }

    flush();
  },
};
