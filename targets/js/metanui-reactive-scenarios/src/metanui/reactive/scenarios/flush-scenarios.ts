import { throwError } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity, type IFlushScheduler } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

class FlushScenarios$CountingScheduler implements IFlushScheduler {
  requests: number = 0;
  private readonly _failFirst: boolean;

  constructor(failFirst: boolean) {
    this._failFirst = failFirst;
  }

  schedule(flush: () => void): void {
    this.requests = (this.requests + 1) | 0;

    if (this._failFirst && this.requests === 1) {
      throw new InvalidOperationException("Scheduler failed.");
    }
  }
}

class FlushScenarios$ThrowingComparer {
  constructor() { }

  equals(x: number, y: number): boolean {
    return throwError(new InvalidOperationException("Comparer failed."));
  }

  getHashCode(value: number): number {
    return value;
  }
}

export class FlushScenarios {
  static readonly all: Scenario[] = [new Scenario("write during a flush schedules no extra flush", FlushScenarios.writeDuringFlushSchedulesNoExtraFlush), new Scenario("flush inside an apply is a no-op", FlushScenarios.flushInsideApplyIsNoOp), new Scenario("throwing scheduler does not block later writes", FlushScenarios.throwingSchedulerDoesNotBlockLaterWrites), new Scenario("throwing comparer still propagates committed signals", FlushScenarios.throwingComparerStillPropagates)];

  constructor() { }

  private static writeDuringFlushSchedulesNoExtraFlush(expect: IExpect): void {
    const scheduler = new FlushScenarios$CountingScheduler(false);
    const source = Reactivity.signal(0);
    const relayed = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number | null) => relayed.value = (value + 1) | 0);
    FlushScenarios.withScheduler(scheduler, () => {
      Reactivity.flush();
      source.value = 1;
      Reactivity.flush();
    });
    expect.equal(2, relayed.value, "write in apply committed by the running flush");
    expect.equal(1, scheduler.requests, "flushes requested");
  }

  private static flushInsideApplyIsNoOp(expect: IExpect): void {
    let log = "";
    const source = Reactivity.signal(0);
    const relayed = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number | null) => {
      relayed.value = (value + 1) | 0;
      Reactivity.flush();
      log = (log ?? "") + ("a" + relayed.value + ",");
    });
    Reactivity.effect(() => relayed.value, (value: number, previous: number | null) => log = (log ?? "") + ("b" + value + ","));
    Reactivity.flush();
    expect.equal("a0,b0,b1,", log, "the nested flush neither commits nor runs applies early");
  }

  private static throwingSchedulerDoesNotBlockLaterWrites(expect: IExpect): void {
    const scheduler = new FlushScenarios$CountingScheduler(true);
    const signal = Reactivity.signal(0);
    let error = null as Exception | null;
    FlushScenarios.withScheduler(scheduler, () => {
      Reactivity.flush();
      error = ScenarioRunner.catch(() => signal.value = 1);
      signal.value = 2;
    });
    expect.isTrue(error instanceof InvalidOperationException, "the scheduler exception reaches the writer");
    expect.equal(2, scheduler.requests, "the later write schedules again");
    Reactivity.flush();
    expect.equal(2, signal.value, "the queued write commits");
  }

  private static throwingComparerStillPropagates(expect: IExpect): void {
    const plain = Reactivity.signal(0);
    const throwing = Reactivity.signal(0, new FlushScenarios$ThrowingComparer());
    const doubled = Reactivity.computed(() => Math.imul(plain.value, 2));
    expect.equal(0, doubled.value, "initial value");
    plain.value = 1;
    throwing.value = 1;
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error instanceof InvalidOperationException, "the comparer exception leaves the flush");
    expect.equal(2, doubled.value, "the signal committed before the throw was propagated");
    expect.isTrue(ScenarioRunner.catch(Reactivity.flush) == null, "the next flush is clean");
  }

  private static withScheduler(scheduler: IFlushScheduler, action: () => void): void {
    const previous = Reactivity.scheduler;
    Reactivity.scheduler = scheduler;
    try {
      action();
    } finally {
      Reactivity.scheduler = previous;
    }
  }
}
