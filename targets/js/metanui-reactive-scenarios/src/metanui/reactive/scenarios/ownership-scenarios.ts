import { HashCode, copyRecordWith } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity, type Computed, type Signal } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

class OwnershipScenarios$Marker {
  constructor(readonly name: string) { }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && this.name === other.name;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.name);

    return hc.toHashCode();
  }

  with(overrides?: Partial<OwnershipScenarios$Marker>): OwnershipScenarios$Marker {
    return copyRecordWith<OwnershipScenarios$Marker>(this, overrides);
  }

  toString(): string {
    return `Marker { Name = ${this.name} }`;
  }
}

class OwnershipScenarios$DisposingGraph {
  dispose: () => void = () => {
  };

  private readonly _source: Signal<number>;

  constructor(source: Signal<number>) {
    this._source = source;
  }

  createInner(): Computed<number> {
    return Reactivity.computed(() => {
      const value = this._source.value;
      Reactivity.onCleanup(() => {
        if (value === 0) {
          this.dispose();
        }
      });

      return value;
    });
  }
}

class OwnershipScenarios$LateChildren {
  readonly source: Signal<number> = Reactivity.signal(0);
  computes: number = 0;
  applies: number = 0;
  cleanups: number = 0;

  constructor() { }

  create(): void {
    Reactivity.effect(() => {
      this.computes = (this.computes + 1) | 0;

      return this.source.value;
    }, (value: number, previous: number) => this.applies = (this.applies + 1) | 0);
    Reactivity.onCleanup(() => this.cleanups = (this.cleanups + 1) | 0);
  }
}

export class OwnershipScenarios {
  static readonly all: Scenario[] = [new Scenario("root dispose runs cleanups in reverse order", OwnershipScenarios.rootDisposeRunsCleanupsInReverse), new Scenario("children are disposed when their owner reruns", OwnershipScenarios.childrenDisposedOnRerun), new Scenario("computed owned by a root is disposed with it", OwnershipScenarios.computedOwnedByRootIsDisposed), new Scenario("untrack does not subscribe", OwnershipScenarios.untrackDoesNotSubscribe), new Scenario("dispose during a flush skips the queued effects", OwnershipScenarios.disposeDuringFlushSkipsQueuedEffects), new Scenario("write inside untrack in a computed throws", OwnershipScenarios.writeInsideUntrackInComputedThrows), new Scenario("write in a root created in a computed throws", OwnershipScenarios.writeInRootInsideComputedThrows), new Scenario("write in a root nested in a root is allowed", OwnershipScenarios.writeInNestedRootIsAllowed), new Scenario("disposed queued effect neither applies nor resubscribes", OwnershipScenarios.disposedQueuedEffectNeitherAppliesNorResubscribes), new Scenario("apply cleanup that disposes its effect skips the apply", OwnershipScenarios.applyCleanupThatDisposesItsEffectSkipsTheApply), new Scenario("compute cleanup that disposes its effect skips the compute", OwnershipScenarios.computeCleanupThatDisposesItsEffectSkipsTheCompute), new Scenario("computed disposed by its own cleanup keeps the value of that run", OwnershipScenarios.computedDisposedByItsOwnCleanupKeepsTheValueOfThatRun), new Scenario("computed disposed during its own run disposes what that run created next", OwnershipScenarios.computedDisposedDuringItsRunDisposesWhatTheRunCreated), new Scenario("effect disposed during its own compute disposes what that compute created next", OwnershipScenarios.effectDisposedDuringItsComputeDisposesWhatTheComputeCreated), new Scenario("computed that loses its last observer unlinks and reruns on the next read", OwnershipScenarios.computedLosingItsLastObserverUnlinksAndRerunsOnTheNextRead), new Scenario("computed without dependencies that loses its last observer disposes what it created", OwnershipScenarios.computedWithoutDepsLosingItsLastObserverDisposesWhatItCreated), new Scenario("root disposed by its own body disposes what the body created next", OwnershipScenarios.rootDisposedByItsBodyDisposesWhatTheBodyCreated), new Scenario("error boundary disposed by its own body disposes what the body created next", OwnershipScenarios.boundaryDisposedByItsBodyDisposesWhatTheBodyCreated), new Scenario("error boundary disposed by its own body disposes what it created before its handler runs", OwnershipScenarios.boundaryDisposedByItsBodyDisposesWhatItCreatedBeforeItsHandler), new Scenario("pending computed disposed during its own dirty check keeps its last value", OwnershipScenarios.pendingComputedDisposedDuringItsCheckKeepsItsLastValue), new Scenario("pending computed disposed during an observer's dirty check keeps its last value", OwnershipScenarios.pendingComputedDisposedDuringAnObserversCheckKeepsItsLastValue), new Scenario("effect disposed during its dirty check stops at the dependency that disposed it", OwnershipScenarios.effectDisposedDuringItsCheckStopsAtTheDisposingDependency), new Scenario("effect disposed during a multi-level dirty check leaves no computed linked", OwnershipScenarios.effectDisposedDuringMultiLevelCheckLeavesNoComputedLinked), new Scenario("observer sharing a computed with an effect disposed during its check sees the change", OwnershipScenarios.observerSharingAComputedWithAnEffectDisposedDuringItsCheckSeesTheChange), new Scenario("computed disposed during a dirty check and marked by a nested flush reads its last value", OwnershipScenarios.computedDisposedDuringACheckAndMarkedByANestedFlushReadsItsLastValue)];

  constructor() { }

  private static rootDisposeRunsCleanupsInReverse(expect: IExpect): void {
    let log = "";
    const dispose = Reactivity.rootFuncOfActionT<() => void>((disposeRoot: () => void) => {
      Reactivity.onCleanup(() => log = (log ?? "") + "1,");
      Reactivity.onCleanup(() => log = (log ?? "") + "2,");
      Reactivity.onCleanup(() => log = (log ?? "") + "3,");

      return disposeRoot;
    });
    expect.equal("", log, "no cleanup before dispose");
    dispose();
    expect.equal("3,2,1,", log, "cleanups after dispose");
  }

  private static childrenDisposedOnRerun(expect: IExpect): void {
    let alive = 0;
    let created = 0;
    let log = "";
    const count = Reactivity.signal(1);
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
      }, (value: number, previous: number) => {
      });

      return run;
    }, (value: number, previous: number) => {
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
    const source = Reactivity.signal(0);
    const [dispose, computed] = Reactivity.rootFuncOfActionT<[() => void, Computed<number>]>((disposeRoot: () => void) => [disposeRoot, Reactivity.computed(() => {
      runs = (runs + 1) | 0;

      return source.value;
    })] as [() => void, Computed<number>]);
    Reactivity.effect(() => computed.value, (value: number, previous: number) => {
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
    const tracked = Reactivity.signal(0);
    const untracked = Reactivity.signal(0);
    Reactivity.effect(() => {
      computes = (computes + 1) | 0;

      return (tracked.value + Reactivity.untrack(() => untracked.value)) | 0;
    }, (value: number, previous: number) => {
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
    const source = Reactivity.signal(0);
    let disposeInner = () => {
    };
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value > 0) {
        disposeInner();
      }
    });
    disposeInner = Reactivity.rootFuncOfActionT<() => void>((dispose: () => void) => {
      Reactivity.effect(() => source.value, (value: number, previous: number) => appliesOfB = (appliesOfB + 1) | 0);

      return dispose;
    });
    Reactivity.flush();
    expect.equal(1, appliesOfB, "applies of B before the write");
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, appliesOfB, "applies of B after A disposed its root");
  }

  private static writeInsideUntrackInComputedThrows(expect: IExpect): void {
    const target = Reactivity.signal(0);
    const writer = Reactivity.computed(() => {
      Reactivity.untrack(() => target.value = 1);

      return 0;
    });
    const error = ScenarioRunner.catch(() => {
      writer.value;
    });
    expect.isTrue(error instanceof InvalidOperationException, "the write inside untrack throws");
  }

  private static writeInRootInsideComputedThrows(expect: IExpect): void {
    const target = Reactivity.signal(0);
    const writer = Reactivity.computed(() => {
      Reactivity.rootFuncOfActionT<number>((dispose: () => void) => target.value = 1);

      return 0;
    });
    const error = ScenarioRunner.catch(() => {
      const value = writer.value;
    });
    expect.isTrue(error instanceof InvalidOperationException, "the write in the nested root throws");
  }

  private static writeInNestedRootIsAllowed(expect: IExpect): void {
    const target = Reactivity.signal(0);
    const error = ScenarioRunner.catch(() => Reactivity.rootFuncOfActionT<number>((outer: () => void) => Reactivity.rootFuncOfActionT<number>((inner: () => void) => target.value = 1)));
    Reactivity.flush();
    expect.isTrue(error == null, "the write in the nested root does not throw");
    expect.equal(1, target.value, "committed value");
  }

  private static disposedQueuedEffectNeitherAppliesNorResubscribes(expect: IExpect): void {
    const marker = new OwnershipScenarios$Marker("captured");
    let computes = 0;
    let applies = 0;
    let cleanups = 0;
    const source = Reactivity.signal(0);
    const dispose = Reactivity.rootFuncOfActionT<() => void>((disposeRoot: () => void) => {
      Reactivity.effect(() => {
        computes = (computes + 1) | 0;
        Reactivity.onCleanup(() => cleanups = (cleanups + 1) | 0);

        return marker.name + source.value;
      }, (value: string, previous: string) => {
        applies = (applies + 1) | 0;
        Reactivity.onCleanup(() => cleanups = (cleanups + 1) | 0);
      });

      return disposeRoot;
    });
    dispose();
    expect.equal(1, cleanups, "cleanups run by the disposal");
    Reactivity.flush();
    expect.equal(0, applies, "applies after the flush that drains the queue");
    expect.equal(1, cleanups, "cleanups after the flush that drains the queue");
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, computes, "computes after writing the source");
    expect.equal(0, applies, "applies after writing the source");
    expect.equal(1, cleanups, "cleanups after writing the source");
  }

  private static applyCleanupThatDisposesItsEffectSkipsTheApply(expect: IExpect): void {
    let applies = 0;
    const source = Reactivity.signal(0);
    let dispose = () => {
    };
    dispose = Reactivity.rootFuncOfActionT<() => void>((disposeRoot: () => void) => {
      Reactivity.effect(() => source.value, (value: number, previous: number) => {
        applies = (applies + 1) | 0;
        Reactivity.onCleanup(() => dispose());
      });

      return disposeRoot;
    });
    Reactivity.flush();
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, applies, "applies after the cleanup disposed the effect");
  }

  private static computeCleanupThatDisposesItsEffectSkipsTheCompute(expect: IExpect): void {
    let computes = 0;
    const source = Reactivity.signal(0);
    let dispose = () => {
    };
    dispose = Reactivity.rootFuncOfActionT<() => void>((disposeRoot: () => void) => {
      Reactivity.effect(() => {
        computes = (computes + 1) | 0;
        Reactivity.onCleanup(() => dispose());

        return source.value;
      }, (value: number, previous: number) => {
      });

      return disposeRoot;
    });
    Reactivity.flush();
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, computes, "computes after the cleanup disposed the effect");
  }

  private static computedDisposedByItsOwnCleanupKeepsTheValueOfThatRun(expect: IExpect): void {
    let runs = 0;
    const source = Reactivity.signal(0);
    let dispose = () => {
    };
    const computed = Reactivity.rootFuncOfActionT<Computed<number>>((disposeRoot: () => void) => {
      dispose = disposeRoot;

      return Reactivity.computed(() => {
        runs = (runs + 1) | 0;
        Reactivity.onCleanup(() => dispose());

        return Math.imul(source.value, 10);
      });
    });
    expect.equal(0, computed.value, "initial value");
    source.value = 1;
    Reactivity.flush();
    expect.equal(10, computed.value, "value of the run after the cleanup disposed it");
    source.value = 2;
    Reactivity.flush();
    expect.equal(10, computed.value, "a later read returns the frozen value");
    expect.equal(2, runs, "runs");
  }

  private static computedDisposedDuringItsRunDisposesWhatTheRunCreated(expect: IExpect): void {
    const late = new OwnershipScenarios$LateChildren();
    const source = Reactivity.signal(0);
    const computed = Reactivity.rootFuncOfActionT<Computed<number>>((disposeRoot: () => void) => Reactivity.computed(() => {
      const value = source.value;

      if (value === 1) {
        disposeRoot();
        late.create();
      }

      return value;
    }));
    expect.equal(0, computed.value, "initial value");
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, computed.value, "the run that disposed the computed completes");
    OwnershipScenarios.expectLateChildrenGone(expect, late);
  }

  private static effectDisposedDuringItsComputeDisposesWhatTheComputeCreated(expect: IExpect): void {
    const late = new OwnershipScenarios$LateChildren();
    const source = Reactivity.signal(0);
    Reactivity.rootActionOfAction((disposeRoot: () => void) => Reactivity.effect(() => {
      const value = source.value;

      if (value === 1) {
        disposeRoot();
        late.create();
      }

      return value;
    }, (value: number, previous: number) => {
    }));
    Reactivity.flush();
    source.value = 1;
    Reactivity.flush();
    OwnershipScenarios.expectLateChildrenGone(expect, late);
  }

  private static computedLosingItsLastObserverUnlinksAndRerunsOnTheNextRead(expect: IExpect): void {
    let runs = 0;
    let cleanups = 0;
    let seen = 0;
    const source = Reactivity.signal(1);
    const doubled = Reactivity.computed(() => {
      runs = (runs + 1) | 0;
      Reactivity.onCleanup(() => cleanups = (cleanups + 1) | 0);

      return Math.imul(source.value, 2);
    });
    const dispose = Reactivity.rootFuncOfActionT<() => void>((disposeRoot: () => void) => {
      Reactivity.effect(() => doubled.value, (value: number, previous: number) => {
      });

      return disposeRoot;
    });
    Reactivity.flush();
    dispose();
    expect.equal(1, cleanups, "losing its last observer runs the cleanup of its last run");
    source.value = 2;
    Reactivity.flush();
    expect.equal(1, runs, "a write to its old dependency no longer runs it");
    expect.equal(4, doubled.value, "the next read runs it again");
    expect.equal(2, runs, "runs after the read");
    Reactivity.effect(() => doubled.value, (value: number, previous: number) => seen = value);
    Reactivity.flush();
    source.value = 3;
    Reactivity.flush();
    expect.equal(6, seen, "a new observer is updated");
    expect.equal(2, cleanups, "the rerun disposed the cleanup of the read's run");
  }

  private static computedWithoutDepsLosingItsLastObserverDisposesWhatItCreated(expect: IExpect): void {
    let runs = 0;
    let cleanups = 0;
    const constant = Reactivity.computed(() => {
      runs = (runs + 1) | 0;
      Reactivity.onCleanup(() => cleanups = (cleanups + 1) | 0);

      return 1;
    });
    const dispose = Reactivity.rootFuncOfActionT<() => void>((disposeRoot: () => void) => {
      Reactivity.effect(() => constant.value, (value: number, previous: number) => {
      });

      return disposeRoot;
    });
    Reactivity.flush();
    dispose();
    expect.equal(1, cleanups, "losing its last observer runs the cleanup of its last run");
    expect.equal(1, constant.value, "value read again");
    expect.equal(2, runs, "the next read runs it again");
  }

  private static rootDisposedByItsBodyDisposesWhatTheBodyCreated(expect: IExpect): void {
    const late = new OwnershipScenarios$LateChildren();
    Reactivity.rootActionOfAction((disposeRoot: () => void) => {
      disposeRoot();
      late.create();
    });
    OwnershipScenarios.expectLateChildrenGone(expect, late);
  }

  private static boundaryDisposedByItsBodyDisposesWhatTheBodyCreated(expect: IExpect): void {
    let caught = 0;
    const late = new OwnershipScenarios$LateChildren();
    Reactivity.rootActionOfAction((disposeRoot: () => void) => Reactivity.errorBoundary(() => {
      disposeRoot();
      late.create();
      throw new InvalidOperationException("body failed");
    }, (error: Exception) => caught = (caught + 1) | 0));
    expect.equal(1, caught, "the handler received the body error");
    OwnershipScenarios.expectLateChildrenGone(expect, late);
  }

  private static boundaryDisposedByItsBodyDisposesWhatItCreatedBeforeItsHandler(expect: IExpect): void {
    let log = "";
    Reactivity.rootActionOfAction((disposeRoot: () => void) => Reactivity.errorBoundary(() => {
      disposeRoot();
      Reactivity.onCleanup(() => log = (log ?? "") + "cleanup,");
      throw new InvalidOperationException("body failed");
    }, (error: Exception) => log = (log ?? "") + "handler,"));
    expect.equal("cleanup,handler,", log, "order");
  }

  private static pendingComputedDisposedDuringItsCheckKeepsItsLastValue(expect: IExpect): void {
    let runs = 0;
    const source = Reactivity.signal(0);
    const graph = new OwnershipScenarios$DisposingGraph(source);
    const reader = Reactivity.rootFuncOfActionT<Computed<number>>((disposeRoot: () => void) => {
      graph.dispose = disposeRoot;
      const inner = graph.createInner();

      return Reactivity.computed(() => {
        runs = (runs + 1) | 0;

        return (inner.value + 1) | 0;
      });
    });
    expect.equal(1, reader.peek(), "initial value");
    source.value = 1;
    Reactivity.flush();
    const error = ScenarioRunner.catch(() => {
      reader.peek();
    });
    expect.isTrue(error == null, "the read that disposed it does not throw");
    expect.equal(1, reader.peek(), "it keeps its last value");
    expect.equal(1, runs, "its released function never runs");
  }

  private static pendingComputedDisposedDuringAnObserversCheckKeepsItsLastValue(expect: IExpect): void {
    let runs = 0;
    let applied = 0;
    const source = Reactivity.signal(0);
    const graph = new OwnershipScenarios$DisposingGraph(source);
    const reader = Reactivity.rootFuncOfActionT<Computed<number>>((disposeRoot: () => void) => {
      graph.dispose = disposeRoot;
      const inner = graph.createInner();

      return Reactivity.computed(() => {
        runs = (runs + 1) | 0;

        return (inner.value + 1) | 0;
      });
    });
    Reactivity.effect(() => reader.value, (value: number, previous: number) => applied = value);
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error == null, "the flush does not fail");
    expect.equal(1, applied, "the effect keeps the last value");
    expect.equal(1, reader.peek(), "the reader keeps its last value");
    expect.equal(1, runs, "its released function never runs");
  }

  private static effectDisposedDuringItsCheckStopsAtTheDisposingDependency(expect: IExpect): void {
    let secondRuns = 0;
    let applies = 0;
    const source = Reactivity.signal(0);
    let dispose = () => {
    };
    const first = Reactivity.computed(() => {
      const value = source.value;
      Reactivity.onCleanup(() => {
        if (value === 0) {
          dispose();
        }
      });

      return 0;
    });
    const second = Reactivity.computed(() => {
      secondRuns = (secondRuns + 1) | 0;

      return source.value;
    });
    Reactivity.rootActionOfAction((disposeRoot: () => void) => {
      dispose = disposeRoot;
      Reactivity.effect(() => (first.value + second.value) | 0, (value: number, previous: number) => applies = (applies + 1) | 0);
    });
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    const runsAfterCheck = secondRuns;
    source.value = 2;
    Reactivity.flush();
    expect.isTrue(error == null, "the flush does not fail");
    expect.equal(1, applies, "the disposed effect never applies again");
    expect.equal(runsAfterCheck, secondRuns, "the computed only the effect read is unlinked");
  }

  private static effectDisposedDuringMultiLevelCheckLeavesNoComputedLinked(expect: IExpect): void {
    let middleRuns = 0;
    let applies = 0;
    const source = Reactivity.signal(0);
    const graph = new OwnershipScenarios$DisposingGraph(source);
    const inner = graph.createInner();
    const middle = Reactivity.computed(() => {
      middleRuns = (middleRuns + 1) | 0;

      return Math.imul(inner.value, 10);
    });
    Reactivity.rootActionOfAction((disposeRoot: () => void) => {
      graph.dispose = disposeRoot;
      Reactivity.effect(() => middle.value, (value: number, previous: number) => applies = (applies + 1) | 0);
    });
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    const runsAfterCheck = middleRuns;
    source.value = 2;
    Reactivity.flush();
    expect.isTrue(error == null, "the flush does not fail");
    expect.equal(1, applies, "the disposed effect never applies again");
    expect.equal(runsAfterCheck, middleRuns, "the computed only the effect read is unlinked");
  }

  private static observerSharingAComputedWithAnEffectDisposedDuringItsCheckSeesTheChange(expect: IExpect): void {
    let seen = 0;
    const source = Reactivity.signal(0);
    const graph = new OwnershipScenarios$DisposingGraph(source);
    const inner = graph.createInner();
    const middle = Reactivity.computed(() => Math.imul(inner.value, 10));
    Reactivity.rootActionOfAction((disposeRoot: () => void) => {
      graph.dispose = disposeRoot;
      Reactivity.effect(() => middle.value, (value: number, previous: number) => {
      });
    });
    Reactivity.effect(() => middle.value, (value: number, previous: number) => seen = value);
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error == null, "the flush does not fail");
    expect.equal(10, seen, "the other effect applies the new value");
  }

  private static computedDisposedDuringACheckAndMarkedByANestedFlushReadsItsLastValue(expect: IExpect): void {
    const trigger = Reactivity.signal(0);
    const source = Reactivity.signal(0);
    const middle = Reactivity.computed(() => (source.value + 1) | 0);
    let disposeFrozen = () => {
    };
    const frozen = Reactivity.rootFuncOfActionT<Computed<number>>((disposeRoot: () => void) => {
      disposeFrozen = disposeRoot;

      return Reactivity.computed(() => Math.imul(middle.value, 10));
    });
    const inner = Reactivity.computed(() => {
      const value = trigger.value;
      Reactivity.onCleanup(() => {
        if (value === 0) {
          disposeFrozen();
          source.value = 1;
          Reactivity.flush();
        }
      });

      return value;
    });
    const reader = Reactivity.computed(() => inner.value);
    expect.equal(10, frozen.peek(), "initial value");
    expect.equal(0, reader.peek(), "initial reader value");
    trigger.value = 1;
    Reactivity.flush();
    expect.equal(1, reader.peek(), "the reader sees the change");
    const error = ScenarioRunner.catch(() => {
      frozen.peek();
    });
    expect.isTrue(error == null, "the read of the disposed computed does not throw");
    expect.equal(10, frozen.peek(), "it keeps its last value");
  }

  private static expectLateChildrenGone(expect: IExpect, late: OwnershipScenarios$LateChildren): void {
    Reactivity.flush();
    late.source.value = 1;
    Reactivity.flush();
    expect.equal(1, late.cleanups, "the cleanup registered after the disposal ran");
    expect.equal(0, late.applies, "the effect created after the disposal never applied");
    expect.equal(1, late.computes, "the effect created after the disposal never reran");
  }
}
