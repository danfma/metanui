import { throwError } from "metano-runtime";
import { ArgumentNullException } from "metano-runtime/system/exceptions/argument-null-exception";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity, type IFlushScheduler } from "metanui-reactive/metanui/reactive";
import { CountingScheduler } from "./counting-scheduler.js";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

class FlushScenarios$ThrowingComparer {
  equals(x: number, y: number): boolean {
    return throwError(new InvalidOperationException("Comparer failed."));
  }

  getHashCode(value: number): number {
    return value;
  }
}

export class FlushScenarios {
  static readonly all: Scenario[] = [new Scenario("write during a flush schedules no extra flush", FlushScenarios.writeDuringFlushSchedulesNoExtraFlush), new Scenario("flush inside an apply is a no-op", FlushScenarios.flushInsideApplyIsNoOp), new Scenario("throwing scheduler does not block later writes", FlushScenarios.throwingSchedulerDoesNotBlockLaterWrites), new Scenario("throwing comparer still propagates committed signals", FlushScenarios.throwingComparerStillPropagates), new Scenario("write before the scheduler is configured is flushed by the new scheduler", FlushScenarios.writeBeforeSchedulerIsConfiguredIsFlushedByNewScheduler), new Scenario("using a null scheduler throws", FlushScenarios.usingNullSchedulerThrows), new Scenario("nested scenario runner restores the outer scheduler", FlushScenarios.nestedRunnerRestoresOuterScheduler), new Scenario("flush nested in a dirty check leaves the checked computed up to date", FlushScenarios.flushNestedInADirtyCheckLeavesTheCheckedComputedUpToDate)];

  private constructor() { }

  private static flushNestedInADirtyCheckLeavesTheCheckedComputedUpToDate(expect: IExpect): void {
    const trigger = Reactivity.signal(0);
    const late = Reactivity.signal(0);
    const inner = Reactivity.computed(() => {
      if (trigger.value === 1) {
        Reactivity.flush();
      }

      return 0;
    });
    const reader = Reactivity.computed(() => (late.value + inner.value) | 0);
    expect.equal(0, reader.peek(), "initial value");
    trigger.value = 1;
    Reactivity.flush();
    late.value = 99;
    expect.equal(99, reader.peek(), "the read sees the write the nested flush committed");
    expect.equal(99, reader.peek(), "a later read sees it too");
  }

  private static writeDuringFlushSchedulesNoExtraFlush(expect: IExpect): void {
    const scheduler = new CountingScheduler();
    const source = Reactivity.signal(0);
    const relayed = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => relayed.value = (value + 1) | 0);
    Reactivity.flush();
    FlushScenarios.withScheduler(scheduler, () => {
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
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      relayed.value = (value + 1) | 0;
      Reactivity.flush();
      log += "a" + relayed.value + ",";
    });
    Reactivity.effect(() => relayed.value, (value: number, previous: number) => log += "b" + value + ",");
    Reactivity.flush();
    expect.equal("a0,b0,b1,", log, "the nested flush neither commits nor runs applies early");
  }

  private static throwingSchedulerDoesNotBlockLaterWrites(expect: IExpect): void {
    const scheduler = new CountingScheduler(true);
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

  private static writeBeforeSchedulerIsConfiguredIsFlushedByNewScheduler(expect: IExpect): void {
    const scheduler = new CountingScheduler();
    let applied = 0;
    const source = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => applied = value);
    Reactivity.flush();
    source.value = 1;
    FlushScenarios.withScheduler(scheduler, () => expect.equal(1, scheduler.requests, "the new scheduler is asked for the flush"));
    Reactivity.flush();
    expect.equal(1, applied, "the write made before the swap is applied");
  }

  private static usingNullSchedulerThrows(expect: IExpect): void {
    const error = ScenarioRunner.catch(() => Reactivity.useScheduler(null!));
    expect.isTrue(error instanceof ArgumentNullException, "a null scheduler is rejected");
  }

  private static nestedRunnerRestoresOuterScheduler(expect: IExpect): void {
    const scheduler = new CountingScheduler();
    const inner = new Scenario("inner", (_: IExpect) => {
    });
    let restored = false;
    FlushScenarios.withScheduler(scheduler, () => {
      ScenarioRunner.run(inner, expect);
      restored = Reactivity.scheduler === scheduler;
    });
    expect.isTrue(restored, "the outer scheduler is in use after the nested run");
  }

  private static withScheduler(scheduler: IFlushScheduler, action: () => void): void {
    const previous = Reactivity.scheduler;
    Reactivity.useScheduler(scheduler);
    try {
      action();
    } finally {
      Reactivity.useScheduler(previous);
    }
  }
}
