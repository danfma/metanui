import { HashCode, copyRecordWith, type IDisposable } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity, type Signal } from "metanui-reactive/metanui/reactive";
import { ExpectedMessages } from "./expected-messages.js";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

class EffectScenarios$Point {
  declare readonly x: number;
  declare readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && this.x === other.x && this.y === other.y;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.x);
    hc.add(this.y);

    return hc.toHashCode();
  }

  with(overrides?: Partial<EffectScenarios$Point>): EffectScenarios$Point {
    return copyRecordWith<EffectScenarios$Point>(this, overrides);
  }

  toString(): string {
    return `Point { X = ${this.x}, Y = ${this.y} }`;
  }
}

class EffectScenarios$EffectCounts {
  declare computes: number;
  declare applies: number;
  declare computeCleanups: number;
  declare applyCleanups: number;

  constructor() {
    this.computes = 0;
    this.applies = 0;
    this.computeCleanups = 0;
    this.applyCleanups = 0;
  }
}

export class EffectScenarios {
  static readonly all: Scenario[] = [new Scenario("effect computes on creation and applies on flush", EffectScenarios.computeRunsOnCreationApplyOnFlush), new Scenario("apply receives the previous value", EffectScenarios.applyReceivesPrevious), new Scenario("first apply previous equals the value for a value type", EffectScenarios.firstApplyPreviousEqualsValueForValueType), new Scenario("applies run after all computes", EffectScenarios.appliesRunAfterAllComputes), new Scenario("apply is untracked", EffectScenarios.applyIsUntracked), new Scenario("apply cleanup runs before the next apply", EffectScenarios.applyCleanupRunsBeforeNextApply), new Scenario("creating a computation inside an apply throws", EffectScenarios.creatingComputationInsideApplyThrows), new Scenario("cleanup of a computed recomputed in an apply belongs to the computed", EffectScenarios.computedCleanupInApplyBelongsToComputed), new Scenario("write in apply schedules another pass", EffectScenarios.writeInApplySchedulesAnotherPass), new Scenario("effect write loop throws", EffectScenarios.effectWriteLoopThrows), new Scenario("equal record write does not rerun the effect", EffectScenarios.equalRecordWriteDoesNotRerun), new Scenario("effect created in a compute applies before its parent", EffectScenarios.childEffectAppliesBeforeItsParent), new Scenario("effect handle disposes the effect early", EffectScenarios.effectHandleDisposesEarly), new Scenario("effect handle dispose is idempotent", EffectScenarios.effectHandleDisposeIsIdempotent), new Scenario("owner dispose after handle dispose runs nothing twice", EffectScenarios.ownerDisposeAfterHandleDisposeRunsNothingTwice), new Scenario("effect handle disposed during a flush skips the queued apply", EffectScenarios.effectHandleDisposedDuringFlushSkipsQueuedApply), new Scenario("effect handle disposed in its own apply runs no further work", EffectScenarios.effectHandleDisposedInItsOwnApply)];

  private constructor() { }

  private static computeRunsOnCreationApplyOnFlush(expect: IExpect): void {
    let computes = 0;
    let applies = 0;
    let appliedValue = "";
    let appliedPrevious = "";
    const name = Reactivity.signal("first");
    Reactivity.effect(() => {
      computes = (computes + 1) | 0;

      return name.value;
    }, (value: string, previous: string) => {
      applies = (applies + 1) | 0;
      appliedValue = value;
      appliedPrevious = previous;
    });
    expect.equal(1, computes, "computes after creation");
    expect.equal(0, applies, "applies after creation");
    Reactivity.flush();
    expect.equal(1, computes, "computes after flush");
    expect.equal(1, applies, "applies after flush");
    expect.equal("first", appliedValue, "applied value");
    expect.equal("first", appliedPrevious, "first apply previous is the value");
  }

  private static firstApplyPreviousEqualsValueForValueType(expect: IExpect): void {
    let appliedValue = -1;
    let appliedPrevious = -1;
    const count = Reactivity.signal(7);
    Reactivity.effect(() => count.value, (value: number, previous: number) => {
      appliedValue = value;
      appliedPrevious = previous;
    });
    Reactivity.flush();
    expect.equal(7, appliedValue, "applied value");
    expect.equal(7, appliedPrevious, "first apply previous is the value");
  }

  private static applyReceivesPrevious(expect: IExpect): void {
    let appliedValue = -1;
    let appliedPrevious = -1;
    const count = Reactivity.signal(1);
    Reactivity.effect(() => count.value, (value: number, previous: number) => {
      appliedValue = value;
      appliedPrevious = previous;
    });
    Reactivity.flush();
    count.value = 2;
    Reactivity.flush();
    expect.equal(2, appliedValue, "applied value");
    expect.equal(1, appliedPrevious, "applied previous");
  }

  private static appliesRunAfterAllComputes(expect: IExpect): void {
    let log = "";
    const count = Reactivity.signal(0);
    Reactivity.effect(() => {
      log += "c1,";

      return count.value;
    }, (value: number, previous: number) => log += "a1,");
    Reactivity.effect(() => {
      log += "c2,";

      return count.value;
    }, (value: number, previous: number) => log += "a2,");
    Reactivity.flush();
    log = "";
    count.value = 1;
    Reactivity.flush();
    expect.equal("c1,c2,a1,a2,", log, "order of computes and applies");
  }

  private static applyIsUntracked(expect: IExpect): void {
    let computes = 0;
    let applies = 0;
    const tracked = Reactivity.signal(0);
    const readInApply = Reactivity.signal(0);
    Reactivity.effect(() => {
      computes = (computes + 1) | 0;

      return tracked.value;
    }, (value: number, previous: number) => {
      applies = (applies + 1) | 0;
      const untracked = readInApply.value;
    });
    Reactivity.flush();
    readInApply.value = 1;
    Reactivity.flush();
    expect.equal(1, computes, "computes after writing a signal read only in apply");
    expect.equal(1, applies, "applies after writing a signal read only in apply");
  }

  private static applyCleanupRunsBeforeNextApply(expect: IExpect): void {
    let log = "";
    const count = Reactivity.signal(1);
    Reactivity.effect(() => count.value, (value: number, previous: number) => {
      log += "apply" + value + ",";
      Reactivity.onCleanup(() => log += "cleanup" + value + ",");
    });
    Reactivity.flush();
    count.value = 2;
    Reactivity.flush();
    expect.equal("apply1,cleanup1,apply2,", log, "cleanup order");
  }

  private static creatingComputationInsideApplyThrows(expect: IExpect): void {
    let computedError = null as Exception | null;
    let effectError = null as Exception | null;
    let rootError = null as Exception | null;
    Reactivity.effect(() => 0, (value: number, previous: number) => {
      computedError = ScenarioRunner.catch(() => {
        const computed = Reactivity.computed(() => 1);
      });
      effectError = ScenarioRunner.catch(() => Reactivity.effect(() => 1, (innerValue: number, innerPrevious: number) => {
      }));
      rootError = ScenarioRunner.catch(() => Reactivity.rootVoid((dispose: () => void) => {
      }));
    });
    Reactivity.flush();
    expect.isTrue(computedError instanceof InvalidOperationException, "computed in an apply throws");
    expect.isTrue(effectError instanceof InvalidOperationException, "effect in an apply throws");
    expect.isTrue(rootError instanceof InvalidOperationException, "root in an apply throws");
  }

  private static computedCleanupInApplyBelongsToComputed(expect: IExpect): void {
    let log = "";
    const count = Reactivity.signal(1);
    const nested = Reactivity.computed(() => {
      const value = count.value;
      Reactivity.onCleanup(() => log += "computed-cleanup" + value + ",");

      return value;
    });
    Reactivity.effect(() => count.value, (value: number, previous: number) => {
      log += "apply" + value + ",";
      const read = nested.value;
    });
    Reactivity.flush();
    count.value = 2;
    Reactivity.flush();
    expect.equal("apply1,apply2,computed-cleanup1,", log, "the cleanup ran with its computed");
  }

  private static writeInApplySchedulesAnotherPass(expect: IExpect): void {
    let lastApplied = -1;
    const source = Reactivity.signal(1);
    const relayed = Reactivity.signal(0);
    Reactivity.effect(() => source.value, (value: number, previous: number) => relayed.value = Math.imul(value, 10));
    Reactivity.effect(() => relayed.value, (value: number, previous: number) => lastApplied = value);
    Reactivity.flush();
    expect.equal(10, lastApplied, "value applied by the reader of the relayed signal");
  }

  private static effectWriteLoopThrows(expect: IExpect): void {
    const count = Reactivity.signal(0);
    Reactivity.effect(() => count.value, (value: number, previous: number) => count.value = (value + 1) | 0);
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error instanceof InvalidOperationException, "the pass limit throws");
    expect.equal(ExpectedMessages.passLimit, error?.message ?? null, "pass limit message");
    expect.isTrue(ScenarioRunner.catch(Reactivity.flush) == null, "the next flush is clean");
  }

  private static equalRecordWriteDoesNotRerun(expect: IExpect): void {
    let computes = 0;
    let applies = 0;
    const point = Reactivity.signal(new EffectScenarios$Point(1, 2));
    Reactivity.effect(() => {
      computes = (computes + 1) | 0;

      return point.value;
    }, (value: EffectScenarios$Point, previous: EffectScenarios$Point) => applies = (applies + 1) | 0);
    Reactivity.flush();
    point.value = new EffectScenarios$Point(1, 2);
    Reactivity.flush();
    expect.equal(1, computes, "computes after an equal write");
    expect.equal(1, applies, "applies after an equal write");
  }

  private static childEffectAppliesBeforeItsParent(expect: IExpect): void {
    let log = "";
    Reactivity.effect(() => {
      Reactivity.effect(() => 0, (value: number, previous: number) => log += "child,");

      return 0;
    }, (value: number, previous: number) => log += "parent,");
    Reactivity.flush();
    expect.equal("child,parent,", log, "apply order");
  }

  private static effectHandleDisposesEarly(expect: IExpect): void {
    const counts = new EffectScenarios$EffectCounts();
    const source = Reactivity.signal(0);
    const handle = EffectScenarios.countedEffect(source, counts);
    Reactivity.flush();
    handle.dispose();
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, counts.computes, "computes after dispose and a write");
    expect.equal(1, counts.applies, "applies after dispose and a write");
    expect.equal(1, counts.computeCleanups, "compute cleanups after dispose");
    expect.equal(1, counts.applyCleanups, "apply cleanups after dispose");
  }

  private static effectHandleDisposeIsIdempotent(expect: IExpect): void {
    const counts = new EffectScenarios$EffectCounts();
    const source = Reactivity.signal(0);
    const handle = EffectScenarios.countedEffect(source, counts);
    Reactivity.flush();
    handle.dispose();
    handle.dispose();
    expect.equal(1, counts.computeCleanups, "compute cleanups after two disposes");
    expect.equal(1, counts.applyCleanups, "apply cleanups after two disposes");
  }

  private static ownerDisposeAfterHandleDisposeRunsNothingTwice(expect: IExpect): void {
    const counts = new EffectScenarios$EffectCounts();
    let rootCleanups = 0;
    const source = Reactivity.signal(0);
    let handle: IDisposable = null!;
    const disposeRoot = Reactivity.rootBody<() => void>((dispose: () => void) => {
      Reactivity.onCleanup(() => rootCleanups = (rootCleanups + 1) | 0);
      handle = EffectScenarios.countedEffect(source, counts);

      return dispose;
    });
    Reactivity.flush();
    handle.dispose();
    disposeRoot();
    expect.equal(1, counts.computeCleanups, "compute cleanups after both disposals");
    expect.equal(1, counts.applyCleanups, "apply cleanups after both disposals");
    expect.equal(1, rootCleanups, "root cleanups after both disposals");
  }

  private static effectHandleDisposedDuringFlushSkipsQueuedApply(expect: IExpect): void {
    let appliesOfB = 0;
    const source = Reactivity.signal(0);
    let handleOfB: IDisposable = null!;
    Reactivity.effect(() => source.value, (value: number, previous: number) => {
      if (value > 0) {
        handleOfB.dispose();
      }
    });
    handleOfB = Reactivity.effect(() => source.value, (value: number, previous: number) => appliesOfB = (appliesOfB + 1) | 0);
    Reactivity.flush();
    expect.equal(1, appliesOfB, "applies of B before the write");
    source.value = 1;
    Reactivity.flush();
    expect.equal(1, appliesOfB, "applies of B after A disposed its handle");
  }

  private static effectHandleDisposedInItsOwnApply(expect: IExpect): void {
    let log = "";
    const source = Reactivity.signal(0);
    let handle: IDisposable = null!;
    handle = Reactivity.effect(() => source.value, (value: number, previous: number) => {
      Reactivity.onCleanup(() => log += "cleanup" + value + ",");

      if (value > 0) {
        handle.dispose();
      }

      log += "apply" + value + ",";
    });
    Reactivity.flush();
    source.value = 1;
    Reactivity.flush();
    source.value = 2;
    Reactivity.flush();
    expect.equal("apply0,cleanup0,cleanup1,apply1,", log, "self-disposal order");
  }

  private static countedEffect(source: Signal<number>, counts: EffectScenarios$EffectCounts): IDisposable {
    return Reactivity.effect(() => {
      counts.computes = (counts.computes + 1) | 0;
      Reactivity.onCleanup(() => counts.computeCleanups = (counts.computeCleanups + 1) | 0);

      return source.value;
    }, (value: number, previous: number) => {
      counts.applies = (counts.applies + 1) | 0;
      Reactivity.onCleanup(() => counts.applyCleanups = (counts.applyCleanups + 1) | 0);
    });
  }
}
