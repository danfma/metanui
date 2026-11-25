import { HashCode, copyRecordWith } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

class EffectScenarios$Point {
  constructor(readonly x: number, readonly y: number) { }

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

export class EffectScenarios {
  private static readonly passLimitMessage: string = "Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.";
  static readonly all: Scenario[] = [new Scenario("effect computes on creation and applies on flush", EffectScenarios.computeRunsOnCreationApplyOnFlush), new Scenario("apply receives the previous value", EffectScenarios.applyReceivesPrevious), new Scenario("first apply previous equals the value for a value type", EffectScenarios.firstApplyPreviousEqualsValueForValueType), new Scenario("applies run after all computes", EffectScenarios.appliesRunAfterAllComputes), new Scenario("apply is untracked", EffectScenarios.applyIsUntracked), new Scenario("apply cleanup runs before the next apply", EffectScenarios.applyCleanupRunsBeforeNextApply), new Scenario("creating a computation inside an apply throws", EffectScenarios.creatingComputationInsideApplyThrows), new Scenario("cleanup of a computed recomputed in an apply belongs to the computed", EffectScenarios.computedCleanupInApplyBelongsToComputed), new Scenario("write in apply schedules another pass", EffectScenarios.writeInApplySchedulesAnotherPass), new Scenario("effect write loop throws", EffectScenarios.effectWriteLoopThrows), new Scenario("equal record write does not rerun the effect", EffectScenarios.equalRecordWriteDoesNotRerun)];

  constructor() { }

  private static computeRunsOnCreationApplyOnFlush(expect: IExpect): void {
    let computes = 0;
    let applies = 0;
    let appliedValue = "";
    let appliedPrevious = "";
    const name = Reactivity.signal("first");
    Reactivity.effect(() => {
      computes = (computes + 1) | 0;

      return name.value;
    }, (value: string, previous: string | null) => {
      applies = (applies + 1) | 0;
      appliedValue = value;
      appliedPrevious = previous!;
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
    let appliedPrevious = null as number | null;
    const count = Reactivity.signal(7);
    Reactivity.effect(() => count.value, (value: number, previous: number | null) => {
      appliedValue = value;
      appliedPrevious = previous;
    });
    Reactivity.flush();
    expect.equal(7, appliedValue, "applied value");
    expect.equal<number | null>(7, appliedPrevious, "first apply previous is the value");
  }

  private static applyReceivesPrevious(expect: IExpect): void {
    let appliedValue = -1;
    let appliedPrevious = null as number | null;
    const count = Reactivity.signal(1);
    Reactivity.effect(() => count.value, (value: number, previous: number | null) => {
      appliedValue = value;
      appliedPrevious = previous;
    });
    Reactivity.flush();
    count.value = 2;
    Reactivity.flush();
    expect.equal(2, appliedValue, "applied value");
    expect.equal<number | null>(1, appliedPrevious, "applied previous");
  }

  private static appliesRunAfterAllComputes(expect: IExpect): void {
    let log = "";
    const count = Reactivity.signal(0);
    Reactivity.effect(() => {
      log = (log ?? "") + "c1,";

      return count.value;
    }, (value: number, previous: number | null) => log = (log ?? "") + "a1,");
    Reactivity.effect(() => {
      log = (log ?? "") + "c2,";

      return count.value;
    }, (value: number, previous: number | null) => log = (log ?? "") + "a2,");
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
    }, (value: number, previous: number | null) => {
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
    Reactivity.effect(() => count.value, (value: number, previous: number | null) => {
      log = (log ?? "") + ("apply" + value + ",");
      Reactivity.onCleanup(() => log = (log ?? "") + ("cleanup" + value + ","));
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
    Reactivity.effect(() => 0, (value: number, previous: number | null) => {
      computedError = ScenarioRunner.catch(() => {
        const computed = Reactivity.computed(() => 1);
      });
      effectError = ScenarioRunner.catch(() => Reactivity.effect(() => 1, (innerValue: number, innerPrevious: number | null) => {
      }));
      rootError = ScenarioRunner.catch(() => Reactivity.rootActionOfAction((dispose: () => void) => {
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
      Reactivity.onCleanup(() => log = (log ?? "") + ("computed-cleanup" + value + ","));

      return value;
    });
    Reactivity.effect(() => count.value, (value: number, previous: number | null) => {
      log = (log ?? "") + ("apply" + value + ",");
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
    Reactivity.effect(() => source.value, (value: number, previous: number | null) => relayed.value = Math.imul(value, 10));
    Reactivity.effect(() => relayed.value, (value: number, previous: number | null) => lastApplied = value);
    Reactivity.flush();
    expect.equal(10, lastApplied, "value applied by the reader of the relayed signal");
  }

  private static effectWriteLoopThrows(expect: IExpect): void {
    const count = Reactivity.signal(0);
    Reactivity.effect(() => count.value, (value: number, previous: number | null) => count.value = (value + 1) | 0);
    const error = ScenarioRunner.catch(Reactivity.flush);
    expect.isTrue(error instanceof InvalidOperationException, "the pass limit throws");
    expect.equal(EffectScenarios.passLimitMessage, error?.message ?? null, "pass limit message");
    expect.isTrue(ScenarioRunner.catch(Reactivity.flush) == null, "the next flush is clean");
  }

  private static equalRecordWriteDoesNotRerun(expect: IExpect): void {
    let computes = 0;
    let applies = 0;
    const point = Reactivity.signal(new EffectScenarios$Point(1, 2));
    Reactivity.effect(() => {
      computes = (computes + 1) | 0;

      return point.value;
    }, (value: EffectScenarios$Point, previous: EffectScenarios$Point | null) => applies = (applies + 1) | 0);
    Reactivity.flush();
    point.value = new EffectScenarios$Point(1, 2);
    Reactivity.flush();
    expect.equal(1, computes, "computes after an equal write");
    expect.equal(1, applies, "applies after an equal write");
  }
}
