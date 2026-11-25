// Adapter for milomg/js-reactivity-benchmark: copied into the harness's `frameworks/` by
// scripts/bench-reactivity.sh, so the `../util` import resolves there, not here.
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { ReactiveFramework } from "../util/reactiveFramework";

// One disposer per `withBuild`: the harness may build several roots before one `cleanup`.
const rootDisposers: (() => void)[] = [];

function discardValue(): void {}

export const metanuiFramework: ReactiveFramework = {
  name: "Metanui",

  signal: (initialValue) => {
    const node = Reactivity.signal(initialValue);

    return {
      read: () => node.value,

      write: (value) => {
        node.value = value;
      },
    };
  },

  computed: (compute) => {
    const node = Reactivity.computed(compute);

    return { read: () => node.value };
  },

  effect: (run) => {
    Reactivity.effect(() => {
      run();

      return 0;
    }, discardValue);
  },

  // Writes are deferred until `flush()`, so a batch is the writes followed by one flush.
  withBatch: (writes) => {
    writes();
    Reactivity.flush();
  },

  // `Reactivity.root` dispatches on `Function.length` and throws here (danfma/metano#778).
  withBuild: (build) =>
    Reactivity.rootFuncOfActionT((dispose) => {
      rootDisposers.push(dispose);

      return build();
    }),

  // The flush drains effects queued by the disposed roots. Solid 2.0 also flushes on its own
  // microtask between harness ticks; Metanui's default ManualFlushScheduler never does, so without
  // this flush every disposed effect stays queued and the heap grows without bound (see README).
  cleanup: () => {
    for (const dispose of rootDisposers.splice(0)) {
      dispose();
    }

    Reactivity.flush();
  },
};
