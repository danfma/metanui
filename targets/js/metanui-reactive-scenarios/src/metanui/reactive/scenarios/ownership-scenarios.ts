import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Computed, Reactivity, Signal } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

export class OwnershipScenarios {
  static readonly all: Scenario[] = [new Scenario("root dispose runs cleanups in reverse order", OwnershipScenarios.rootDisposeRunsCleanupsInReverse), new Scenario("children are disposed when their owner reruns", OwnershipScenarios.childrenDisposedOnRerun), new Scenario("computed owned by a root is disposed with it", OwnershipScenarios.computedOwnedByRootIsDisposed), new Scenario("untrack does not subscribe", OwnershipScenarios.untrackDoesNotSubscribe), new Scenario("dispose during a flush skips the queued effects", OwnershipScenarios.disposeDuringFlushSkipsQueuedEffects), new Scenario("write inside untrack in a computed throws", OwnershipScenarios.writeInsideUntrackInComputedThrows)];

  constructor() { }

  private static rootDisposeRunsCleanupsInReverse(expect: IExpect): void {
    let log = "";
    const dispose = Reactivity.rootFuncOfActionT<() => void>((dispose$1: () => void) => {
      Reactivity.onCleanup(() => log = (log ?? "") + "1,");
      Reactivity.onCleanup(() => log = (log ?? "") + "2,");
      Reactivity.onCleanup(() => log = (log ?? "") + "3,");

      return dispose$1;
    });
    expect.equal("", log, "no cleanup before dispose");
    dispose();
    expect.equal("3,2,1,", log, "cleanups after dispose");
  }

  private static childrenDisposedOnRerun(expect: IExpect): void {
    let alive = 0;
    let created = 0;
    let log = "";
    const count = new Signal(1);
    Reactivity.effect(() => {
      const run = count.value;
      Reactivity.effect(() => {
        alive = (alive + 1) | 0;
        created = (created + 1) | 0;
        Reactivity.onCleanup(() => {
          alive = (alive - 1) | 0;
          log = (log ?? "") + ("inner" + run + ",");
        });

        return run;
      }, (value: number, previous: number | null) => {
      });

      return run;
    }, (value: number, previous: number | null) => {
    });
    Reactivity.flush();
    count.value = 2;
    Reactivity.flush();
    expect.equal(2, created, "inner effects created");
    expect.equal(1, alive, "inner effects alive after the rerun");
    expect.equal("inner1,", log, "cleanup of the first inner effect");
  }

  private static computedOwnedByRootIsDisposed(expect: IExpect): void {
    let runs = 0;
    const source = new Signal(0);
    let dispose = () => {
    };
    const computed = Reactivity.rootFuncOfActionT<Computed<number>>((disposeRoot: () => void) => {
      dispose = disposeRoot;

      return new Computed(() => {
        runs = (runs + 1) | 0;

        return source.value;
      });
    });
    Reactivity.effect(() => computed.value, (value: number, previous: number | null) => {
    });
    Reactivity.flush();
    source.value = 1;
    Reactivity.flush();
    expect.equal(2, runs, "runs while the root is alive");
    dispose();
    source.value = 2;
    Reactivity.flush();
    expect.equal(2, runs, "runs after the root is disposed");
  }

  private static untrackDoesNotSubscribe(expect: IExpect): void {
    let computes = 0;
    const tracked = new Signal(0);
    const untracked = new Signal(0);
    Reactivity.effect(() => {
      computes = (computes + 1) | 0;

      return (tracked.value + Reactivity.untrack(() => untracked.value)) | 0;
    }, (value: number, previous: number | null) => {
    });
    Reactivity.flush();
    untracked.value = 1;
    Reactivity.flush();
    expect.equal(1, computes, "computes after writing the untracked signal");
    tracked.value = 1;
    Reactivity.flush();
    expect.equal(2, computes, "computes after writing the tracked signal");
  }

  private static disposeDuringFlushSkipsQueuedEffects(expect: IExpect): void {
    let appliesOfB = 0;
    const source = new Signal(0);
    let disposeInner = () => {
    };
    Reactivity.effect(() => source.value, (value: number, previous: number | null) => {
      if (value > 0) {
        disposeInner();
      }
    });
    disposeInner = Reactivity.rootFuncOfActionT<() => void>((dispose: () => void) => {
      Reactivity.effect(() => source.value, (value: number, previous: number | null) => appliesOfB = (appliesOfB + 1) | 0);

      return dispose;
    });
    Reactivity.flush();
    expect.equal(1, appliesOfB, "applies of B before the write");
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, appliesOfB, "applies of B after A disposed its root");
  }

  private static writeInsideUntrackInComputedThrows(expect: IExpect): void {
    const target = new Signal(0);
    const writer = new Computed(() => {
      Reactivity.untrack(() => target.value = 1);

      return 0;
    });
    const error = ScenarioRunner.catch(() => {
      const value = writer.value;
    });
    expect.isTrue(error instanceof InvalidOperationException, "the write inside untrack throws");
  }
}
