import { intDiv, throwError, toException } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity, type Computed, type IFlushScheduler, type Signal } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

class ErrorScenarios$RecordingScheduler implements IFlushScheduler {
  private _first: ErrorScenarios$RecordingScheduler$RequestedFlush | null = null;
  private _last: ErrorScenarios$RecordingScheduler$RequestedFlush | null = null;

  constructor() { }

  schedule(flush: () => void): void {
    const requested = new ErrorScenarios$RecordingScheduler$RequestedFlush(flush);

    if (this._last == null) {
      this._first = requested;
    } else {
      this._last.next = requested;
    }

    this._last = requested;
  }

  take(): (() => void) | null {
    const first = this._first;

    if (first == null) {
      return null;
    }

    this._first = first.next;

    if (this._first == null) {
      this._last = null;
    }

    return first.flush;
  }
}

class ErrorScenarios$RecordingScheduler$RequestedFlush {
  next: ErrorScenarios$RecordingScheduler$RequestedFlush | null = null;

  constructor(readonly flush: () => void) { }
}

class ErrorScenarios$CountingScheduler implements IFlushScheduler {
  requests: number = 0;

  constructor() { }

  schedule(flush: () => void): void {
    this.requests = (this.requests + 1) | 0;
  }
}

export class ErrorScenarios {
  static readonly all: Scenario[] = [new Scenario("computed rethrows its error until a dependency changes", ErrorScenarios.computedRethrowsUntilDependencyChanges), new Scenario("errored computed without dependencies retries on a tracked re-read after a flush", ErrorScenarios.erroredComputedWithoutDepsRetriesOnTrackedReread), new Scenario("retry that recovers an errored computed updates its other observers", ErrorScenarios.retryThatRecoversUpdatesOtherObservers), new Scenario("error raised in a multi-level dirty check reaches the reader and later walks stay correct", ErrorScenarios.errorInMultiLevelDirtyCheckReachesReader), new Scenario("boundary receives an effect apply error", ErrorScenarios.boundaryReceivesEffectError), new Scenario("boundary receives an effect compute error", ErrorScenarios.boundaryReceivesEffectComputeError), new Scenario("unhandled effect error escapes the flush", ErrorScenarios.unhandledEffectErrorEscapesFlush), new Scenario("throwing effect defers the others to the next flush", ErrorScenarios.throwingEffectDefersOthersToNextFlush), new Scenario("work left by a failed compute runs on the next flush", ErrorScenarios.workLeftByFailedComputeRunsOnNextFlush), new Scenario("throwing effect that writes what it reads stops at the pass limit", ErrorScenarios.throwingSelfWritingEffectStopsAtPassLimit), new Scenario("effect that throws on every change never hits the pass limit", ErrorScenarios.effectThrowingOnEveryChangeNeverHitsPassLimit), new Scenario("resume made stale by a direct flush spends no pass budget", ErrorScenarios.staleResumeSpendsNoPassBudget), new Scenario("apply after a skipped apply receives the last applied value", ErrorScenarios.applyAfterSkippedApplyReceivesLastApplied), new Scenario("throwing apply cleanup still runs the others and reaches the boundary", ErrorScenarios.throwingApplyCleanupReachesBoundary), new Scenario("unhandled apply cleanup error escapes after the others ran", ErrorScenarios.unhandledApplyCleanupErrorEscapes), new Scenario("apply cleanup that disposes its effect and throws reaches the boundary", ErrorScenarios.selfDisposingApplyCleanupErrorReachesBoundary), new Scenario("effect compute that disposes its effect and throws reaches the boundary", ErrorScenarios.selfDisposingComputeErrorReachesBoundary), new Scenario("throwing cleanup does not abort the disposal", ErrorScenarios.throwingCleanupDoesNotAbortDisposal), new Scenario("throwing cleanup in a rerun is rethrown after the flush", ErrorScenarios.throwingCleanupInRerunIsRethrownAfterFlush), new Scenario("disposer called in a computed defers its cleanup error to the flush", ErrorScenarios.disposerInComputedDefersCleanupError), new Scenario("disposer called in an effect compute keeps its cleanup error from the boundary", ErrorScenarios.disposerInEffectComputeKeepsCleanupErrorFromBoundary), new Scenario("disposer called in a boundary body keeps its cleanup error from the boundary", ErrorScenarios.disposerInBoundaryBodyKeepsCleanupErrorFromBoundary), new Scenario("write from a cleanup during disposal is allowed", ErrorScenarios.writeFromCleanupDuringDisposalIsAllowed), new Scenario("computed that disposes itself mid-run keeps no dependency", ErrorScenarios.selfDisposingComputedKeepsNoDependency), new Scenario("runner keeps the scenario error and drains leftover writes", ErrorScenarios.runnerKeepsScenarioErrorAndDrainsLeftovers)];

  constructor() { }

  private static computedRethrowsUntilDependencyChanges(expect: IExpect): void {
    let runs = 0;
    const source = Reactivity.signal(0);
    const quotient = Reactivity.computed(() => {
      runs = (runs + 1) | 0;
      const divisor = source.value;

      if (divisor === 0) {
        throw new InvalidOperationException("Division by zero.");
      }

      return intDiv(10, divisor);
    });
    const first = ScenarioRunner.catch(() => ErrorScenarios.read(() => quotient.value));
    const second = ScenarioRunner.catch(() => ErrorScenarios.read(() => quotient.peek()));
    expect.isTrue(first instanceof InvalidOperationException, "the first read throws");
    expect.isTrue(first === second, "the second read throws the same instance");
    expect.equal(1, runs, "compute runs before the fix");
    source.value = 5;
    Reactivity.flush();
    expect.equal(2, quotient.value, "value after the dependency changed");
    expect.equal(2, runs, "compute runs after the fix");
  }

  private static erroredComputedWithoutDepsRetriesOnTrackedReread(expect: IExpect): void {
    let runs = 0;
    let seen = 0;
    const trigger = Reactivity.signal(0);
    const flaky = Reactivity.computed(() => {
      runs = (runs + 1) | 0;

      if (runs === 1) {
        throw new InvalidOperationException("First run fails.");
      }

      return 42;
    });
    const first = ScenarioRunner.catch(() => ErrorScenarios.read(() => flaky.value));
    const second = ScenarioRunner.catch(() => ErrorScenarios.read(() => flaky.value));
    expect.isTrue(!(first == null) && first === second, "untracked reads rethrow the error");
    expect.equal(1, runs, "untracked reads do not retry");
    Reactivity.effect(() => {
      ErrorScenarios.read(() => trigger.value);

      return ErrorScenarios.readOr(flaky, -1);
    }, (value: number, previous: number) => seen = value);
    Reactivity.flush();
    expect.equal(-1, seen, "a first tracked read sees the error");
    expect.equal(1, runs, "a first tracked read does not retry");
    trigger.value = 1;
    Reactivity.flush();
    expect.equal(42, seen, "a tracked re-read after a flush retries");
    expect.equal(2, runs, "compute runs after the retry");
  }

  private static retryThatRecoversUpdatesOtherObservers(expect: IExpect): void {
    let runs = 0;
    let retrying = 0;
    let sibling = 0;
    const trigger = Reactivity.signal(0);
    const flaky = Reactivity.computed(() => {
      runs = (runs + 1) | 0;

      if (runs === 1) {
        throw new InvalidOperationException("First run fails.");
      }

      return 42;
    });
    const derived = Reactivity.computed(() => (ErrorScenarios.readOr(flaky, -1) + 1) | 0);
    Reactivity.effect(() => {
      ErrorScenarios.read(() => trigger.value);

      return ErrorScenarios.readOr(flaky, -1);
    }, (value: number, previous: number) => retrying = value);
    Reactivity.effect(() => ErrorScenarios.readOr(flaky, -1), (value: number, previous: number) => sibling = value);
    Reactivity.effect(() => derived.value, (value: number, previous: number) => {
    });
    Reactivity.flush();
    expect.equal(-1, sibling, "the sibling effect first sees the error");
    expect.equal(0, derived.value, "the computed first sees the error");
    trigger.value = 1;
    Reactivity.flush();
    expect.equal(42, retrying, "the re-reading effect recovered the value");
    expect.equal(42, sibling, "the sibling effect sees the recovered value");
    expect.equal(43, derived.value, "the computed sees the recovered value");
    expect.equal(2, runs, "the function ran once more");
  }

  private static errorInMultiLevelDirtyCheckReachesReader(expect: IExpect): void {
    const source = Reactivity.signal(0);
    const failing = Reactivity.computed(() => ErrorScenarios.failWhenOne(source.value, "Failing."));
    const next = Reactivity.computed(() => (failing.value + 1) | 0);
    const guarded = Reactivity.computed(() => ErrorScenarios.readOr(next, -1));
    expect.equal(1, guarded.value, "value before the error");
    const root = Reactivity.signal(1);
    const doubled = Reactivity.computed(() => Math.imul(root.value, 2));
    const tripled = Reactivity.computed(() => Math.imul(root.value, 3));
    const sum = Reactivity.computed(() => (doubled.value + tripled.value) | 0);
    expect.equal(5, sum.value, "branching graph before the error");
    source.value = 1;
    root.value = 2;
    Reactivity.flush();
    expect.equal(-1, guarded.value, "the error crossed the multi-level dirty check");
    expect.equal(10, sum.value, "a branching graph read afterwards is correct");
  }

  private static boundaryReceivesEffectError(expect: IExpect): void {
    let caught = "";
    const source = Reactivity.signal(0);
    Reactivity.errorBoundary(() => Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value === 1) {
        throw new InvalidOperationException("apply failed");
      }
    }), (error: Exception) => caught = error.message);
    Reactivity.flush();
    source.value = 1;
    const flushError = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(flushError == null, "the flush does not throw");
    expect.equal("apply failed", caught, "the boundary handler got the error");
  }

  private static boundaryReceivesEffectComputeError(expect: IExpect): void {
    let log = "";
    const source = Reactivity.signal(0);
    Reactivity.errorBoundary(() => Reactivity.effect(() => (ErrorScenarios.failWhenOne((source.value + 1) | 0, "compute failed") - 1) | 0, (value: number, previous: number) => log = (log ?? "") + ("apply" + value + ",")), (error: Exception) => log = (log ?? "") + (error.message + ","));
    Reactivity.flush();
    expect.equal("compute failed,", log, "a creation-time compute error reaches the boundary");
    source.value = 1;
    Reactivity.flush();
    expect.equal("compute failed,apply1,", log, "the effect recovers when its dependency changes");
  }

  private static unhandledEffectErrorEscapesFlush(expect: IExpect): void {
    const thrown = new InvalidOperationException("apply failed");
    const source = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value === 1) {
        throw thrown;
      }
    });
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error === thrown, "the flush throws the original exception");
  }

  private static throwingEffectDefersOthersToNextFlush(expect: IExpect): void {
    const thrown = new InvalidOperationException("apply failed");
    let log = "";
    const source = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value === 1) {
        throw thrown;
      }
    });
    Reactivity.effect(() => source.value, (value: number, previous: number) => log = (log ?? "") + ("b" + value + ","));
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error === thrown, "the flush throws at once");
    expect.equal("b0,", log, "the other effect has not applied yet");
    Reactivity.flush();
    expect.equal("b0,b1,", log, "the next flush runs the deferred apply");
  }

  private static workLeftByFailedComputeRunsOnNextFlush(expect: IExpect): void {
    const scheduler = new ErrorScenarios$CountingScheduler();
    let log = "";
    const source = Reactivity.signal(0);
    Reactivity.effect(() => ErrorScenarios.failWhenOne(source.value, "compute failed"), (value: number, previous: number) => {
    });
    Reactivity.effect(() => source.value, (value: number, previous: number) => log = (log ?? "") + ("b" + value + ","));
    Reactivity.flush();
    const previousScheduler = Reactivity.scheduler;
    Reactivity.useScheduler(scheduler);
    try {
      source.value = 1;
      const error = ScenarioRunner.catch(Reactivity.flush);
      expect.isTrue(error instanceof InvalidOperationException, "the compute error escapes");
      expect.equal("b0,", log, "the other effect has not run yet");
      expect.equal(2, scheduler.requests, "the failed flush requests another one");
    } finally {
      Reactivity.useScheduler(previousScheduler);
    }
    Reactivity.flush();
    expect.equal("b0,b1,", log, "the next flush runs the queued compute and apply");
  }

  private static throwingSelfWritingEffectStopsAtPassLimit(expect: IExpect): void {
    const scheduler = new ErrorScenarios$RecordingScheduler();
    let log = "";
    const source = Reactivity.signal(0);
    const other = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value >= 1) {
        source.value = (value + 1) | 0;
        throw new InvalidOperationException("apply failed");
      }
    });
    Reactivity.effect(() => other.value, (value: number, previous: number) => log = (log ?? "") + (value + ","));
    Reactivity.flush();
    const previousScheduler = Reactivity.scheduler;
    let flushes = 0;
    let last = null as Exception | null;
    Reactivity.useScheduler(scheduler);
    try {
      source.value = 1;
      let flush = scheduler.take();
      while (!(flush == null) && flushes < 1000) {
        flushes = (flushes + 1) | 0;
        last = ScenarioRunner.catch(flush);
        flush = scheduler.take();
      }
    } finally {
      Reactivity.useScheduler(previousScheduler);
    }
    expect.equal(101, flushes, "flushes until the pass limit");
    expect.isTrue(!(last == null) && last.message === "Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.", "the last flush stops at the pass limit");
    other.value = 1;
    Reactivity.flush();
    expect.equal("0,1,", log, "the graph is usable afterwards");
  }

  private static effectThrowingOnEveryChangeNeverHitsPassLimit(expect: IExpect): void {
    let failures = 0;
    let passLimitErrors = 0;
    const source = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value !== 0) {
        throw new InvalidOperationException("apply failed");
      }
    });
    Reactivity.flush();
    for (let write = 1; write <= 150; write++) {
      source.value = write;
      const error = ScenarioRunner.catch(Reactivity.flush);

      if (!(error == null) && error.message === "apply failed") {
        failures = (failures + 1) | 0;
      } else {
        if (!(error == null)) {
          passLimitErrors = (passLimitErrors + 1) | 0;
        }
      }
    }
    expect.equal(150, failures, "every flush failed with the effect's own error");
    expect.equal(0, passLimitErrors, "no flush stopped at the pass limit");
    expect.equal(150, source.value, "every write was applied");
  }

  private static staleResumeSpendsNoPassBudget(expect: IExpect): void {
    const scheduler = new ErrorScenarios$RecordingScheduler();
    let deferred = 0;
    let failures = 0;
    const failing = Reactivity.signal(0);
    const counter = Reactivity.signal(0);
    Reactivity.effect(() => failing.value, (value: number, previous: number) => {
      if (value === 1) {
        throw new InvalidOperationException("apply failed");
      }
    });
    Reactivity.effect(() => failing.value, (value: number, previous: number) => deferred = value);
    Reactivity.effect(() => counter.value, (value: number, previous: number) => ErrorScenarios.countUpTo(counter, value, 60));
    Reactivity.flush();
    const previousScheduler = Reactivity.scheduler;
    Reactivity.useScheduler(scheduler);
    try {
      failing.value = 1;
      ScenarioRunner.catch(scheduler.take()!);
      counter.value = 1;
      Reactivity.flush();
      counter.value = 1;
      let flush = scheduler.take();
      while (!(flush == null)) {
        if (!(ScenarioRunner.catch(flush) == null)) {
          failures = (failures + 1) | 0;
        }

        flush = scheduler.take();
      }
    } finally {
      Reactivity.useScheduler(previousScheduler);
    }
    expect.equal(1, deferred, "the direct flush ran the apply the failed flush left");
    expect.equal(0, failures, "no flush failed");
    expect.equal(60, counter.peek(), "the second count completed");
  }

  private static countUpTo(counter: Signal<number>, value: number, limit: number): void {
    if (value > 0 && value < limit) {
      counter.value = (value + 1) | 0;
    }
  }

  private static applyAfterSkippedApplyReceivesLastApplied(expect: IExpect): void {
    let log = "";
    let caught = 0;
    const source = Reactivity.signal(0);
    Reactivity.errorBoundary(() => Reactivity.effect(() => source.value, (value: number, previous: number) => {
      log = (log ?? "") + (value + ":" + previous + ",");

      if (value === 0) {
        Reactivity.onCleanup(() => throwError(new InvalidOperationException("cleanup failed")));
      }
    }), (error: Exception) => caught = (caught + 1) | 0);
    Reactivity.flush();
    source.value = 1;
    Reactivity.flush();
    expect.equal("0:0,", log, "the apply for 1 was skipped by its cleanup error");
    expect.equal(1, caught, "the boundary got the cleanup error");
    source.value = 2;
    Reactivity.flush();
    expect.equal("0:0,2:0,", log, "the next apply receives the last applied value");
  }

  private static throwingApplyCleanupReachesBoundary(expect: IExpect): void {
    let log = "";
    let caught = "";
    const source = Reactivity.signal(0);
    Reactivity.errorBoundary(() => Reactivity.effect(() => source.value, (value: number, previous: number) => {
      log = (log ?? "") + ("apply" + value + ",");

      if (value === 0) {
        ErrorScenarios.registerFailingCleanups(() => log = (log ?? "") + "second,");
      }
    }), (error: Exception) => caught = error.message);
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error == null, "the flush does not throw");
    expect.equal("cleanup failed", caught, "the boundary got the cleanup error");
    expect.equal("apply0,second,", log, "the other cleanup ran and the failed apply did not");
  }

  private static unhandledApplyCleanupErrorEscapes(expect: IExpect): void {
    let log = "";
    const source = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      log = (log ?? "") + ("apply" + value + ",");

      if (value === 0) {
        ErrorScenarios.registerFailingCleanups(() => log = (log ?? "") + "second,");
      }
    });
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(!(error == null) && error.message === "cleanup failed", "the cleanup error escapes the flush");
    expect.equal("apply0,second,", log, "the other cleanup ran first");
  }

  private static selfDisposingApplyCleanupErrorReachesBoundary(expect: IExpect): void {
    let caught = "";
    const source = Reactivity.signal(0);
    Reactivity.rootActionOfAction((disposeRoot: () => void) => Reactivity.errorBoundary(() => Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value === 0) {
        Reactivity.onCleanup(() => ErrorScenarios.disposeAndFail(disposeRoot));
      }
    }), (error: Exception) => caught = error.message));
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error == null, "the flush does not throw");
    expect.equal("disposed and failed", caught, "the boundary got the cleanup error");
  }

  private static selfDisposingComputeErrorReachesBoundary(expect: IExpect): void {
    let caught = "";
    const source = Reactivity.signal(0);
    Reactivity.rootActionOfAction((disposeRoot: () => void) => Reactivity.errorBoundary(() => Reactivity.effect(() => {
      if (source.value === 1) {
        ErrorScenarios.disposeAndFail(disposeRoot);
      }

      return 0;
    }, (value: number, previous: number) => {
    }), (error: Exception) => caught = error.message));
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error == null, "the flush does not throw");
    expect.equal("disposed and failed", caught, "the boundary got the compute error");
  }

  private static disposeAndFail(dispose: () => void): void {
    dispose();
    throw new InvalidOperationException("disposed and failed");
  }

  private static registerFailingCleanups(other: () => void): void {
    Reactivity.onCleanup(other);
    Reactivity.onCleanup(() => throwError(new InvalidOperationException("cleanup failed")));
  }

  private static throwingCleanupDoesNotAbortDisposal(expect: IExpect): void {
    const thrown = new InvalidOperationException("cleanup failed");
    let log = "";
    let caught = "";
    let dispose = () => {
    };
    Reactivity.errorBoundary(() => Reactivity.rootActionOfAction((disposeRoot: () => void) => {
      dispose = disposeRoot;
      Reactivity.effect(() => {
        Reactivity.onCleanup(() => log = (log ?? "") + "child,");

        return 0;
      }, (value: number, previous: number) => {
      });
      Reactivity.onCleanup(() => log = (log ?? "") + "1,");
      Reactivity.onCleanup(() => throwError(new InvalidOperationException("second")));
      Reactivity.onCleanup(() => throwError(thrown));
      Reactivity.onCleanup(() => log = (log ?? "") + "4,");
    }), (error: Exception) => caught = error.message);
    const error = ScenarioRunner.catch(dispose);
    expect.equal("child,4,1,", log, "every cleanup and child ran");
    expect.isTrue(error === thrown, "the disposer rethrows the first error");
    expect.equal("", caught, "cleanup errors do not go to a boundary");
  }

  private static throwingCleanupInRerunIsRethrownAfterFlush(expect: IExpect): void {
    let log = "";
    const source = Reactivity.signal(0);
    Reactivity.effect(() => {
      const value = source.value;
      Reactivity.onCleanup(() => {
        if (value === 0) {
          throw new InvalidOperationException("cleanup failed");
        }
      });

      return value;
    }, (value: number, previous: number) => log = (log ?? "") + ("a" + value + ","));
    Reactivity.flush();
    source.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error instanceof InvalidOperationException, "the flush rethrows the cleanup error");
    expect.equal("a0,a1,", log, "the flush finished before rethrowing");
    expect.isTrue(ScenarioRunner.catch(Reactivity.flush) == null, "the error is rethrown once");
  }

  private static disposerInComputedDefersCleanupError(expect: IExpect): void {
    const thrown = new InvalidOperationException("cleanup failed");
    const dispose = ErrorScenarios.rootWithThrowingCleanup(thrown);
    const computed = Reactivity.computed(() => {
      dispose();

      return 1;
    });
    const readError = ScenarioRunner.catch(() => ErrorScenarios.read(() => computed.value));
    const flushError = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(readError == null, "the computed does not take the cleanup error");
    expect.equal(1, computed.value, "the computed holds its value");
    expect.isTrue(flushError === thrown, "the next flush rethrows the cleanup error");
  }

  private static disposerInEffectComputeKeepsCleanupErrorFromBoundary(expect: IExpect): void {
    const thrown = new InvalidOperationException("cleanup failed");
    let caught = "";
    const dispose = ErrorScenarios.rootWithThrowingCleanup(thrown);
    Reactivity.errorBoundary(() => Reactivity.effect(() => {
      dispose();

      return 0;
    }, (value: number, previous: number) => {
    }), (error: Exception) => caught = error.message);
    const flushError = ScenarioRunner.catch(Reactivity.flush);
    expect.equal("", caught, "the cleanup error does not go to the boundary");
    expect.isTrue(flushError === thrown, "the next flush rethrows the cleanup error");
  }

  private static disposerInBoundaryBodyKeepsCleanupErrorFromBoundary(expect: IExpect): void {
    const thrown = new InvalidOperationException("cleanup failed");
    let caught = "";
    const dispose = ErrorScenarios.rootWithThrowingCleanup(thrown);
    Reactivity.errorBoundary(() => dispose(), (error: Exception) => caught = error.message);
    const flushError = ScenarioRunner.catch(Reactivity.flush);
    expect.equal("", caught, "the cleanup error does not go to the boundary");
    expect.isTrue(flushError === thrown, "the next flush rethrows the cleanup error");
  }

  private static rootWithThrowingCleanup(thrown: Exception): () => void {
    return Reactivity.rootFuncOfActionT<() => void>((disposeRoot: () => void) => {
      Reactivity.onCleanup(() => throwError(thrown));

      return disposeRoot;
    });
  }

  private static writeFromCleanupDuringDisposalIsAllowed(expect: IExpect): void {
    const source = Reactivity.signal(0);
    const other = Reactivity.signal(0);
    const written = Reactivity.signal(-1);
    const inner = Reactivity.computed(() => {
      const value = source.value;
      Reactivity.onCleanup(() => written.value = value);

      return value;
    });
    const outer = Reactivity.computed(() => (other.value + inner.value) | 0);
    expect.equal(0, outer.value, "initial value");
    source.value = 1;
    other.value = 1;
    Reactivity.flush();
    const error = ScenarioRunner.catch(() => ErrorScenarios.read(() => outer.value));
    Reactivity.flush();
    expect.isTrue(error == null, "the write from the cleanup does not throw");
    expect.equal(2, outer.value, "value after the rerun");
    expect.equal(0, written.value, "the cleanup write committed");
  }

  private static selfDisposingComputedKeepsNoDependency(expect: IExpect): void {
    let runs = 0;
    const source = Reactivity.signal(0);
    const late = Reactivity.signal(0);
    let dispose = () => {
    };
    const computed = Reactivity.rootFuncOfActionT<Computed<number>>((disposeRoot: () => void) => {
      dispose = disposeRoot;

      return Reactivity.computed(() => {
        runs = (runs + 1) | 0;
        const value = source.value;

        if (value === 1) {
          dispose();
        }

        return (value + late.value) | 0;
      });
    });
    expect.equal(0, computed.value, "initial value");
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, computed.value, "value of the run that disposed it");
    late.value = 5;
    Reactivity.flush();
    expect.equal(1, computed.value, "a disposed computed keeps its last value");
    expect.equal(2, runs, "the dependency read after disposal does not rerun it");
  }

  private static runnerKeepsScenarioErrorAndDrainsLeftovers(expect: IExpect): void {
    const thrown = new InvalidOperationException("scenario failed");
    const signal = Reactivity.signal(0);
    const inner = new Scenario("inner", (_: IExpect) => {
      Reactivity.onCleanup(() => throwError(new InvalidOperationException("cleanup failed")));
      signal.value = 1;
      throw thrown;
    });
    const error = ScenarioRunner.catch(() => ScenarioRunner.run(inner, expect));
    expect.isTrue(error === thrown, "the scenario error is not masked by the cleanup error");
    expect.equal(1, signal.peek(), "the leftover write was drained");
    expect.isTrue(ScenarioRunner.catch(Reactivity.flush) == null, "no error is left behind");
  }

  private static read<T>(read: () => T): void {
    const value = read();
  }

  private static failWhenOne(value: number, message: string): number {
    if (value === 1) {
      throw new InvalidOperationException(message);
    }

    return value;
  }

  private static readOr<T>(computed: Computed<T>, fallback: T): T {
    try {
      return computed.value;
    } catch (e$) {
      const e0 = toException(e$);
      if (e0 instanceof InvalidOperationException) {
        return fallback;
      } else {
        throw e$;
      }
    }
  }
}
