import { List } from "metano-runtime/system/collections";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Computed, Reactivity, Signal } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { ScenarioRunner } from "./scenario-runner.js";
import { Scenario } from "./scenario.js";

export class ComputedScenarios {
  static readonly all: Scenario[] = [new Scenario("computed is lazy", ComputedScenarios.isLazy), new Scenario("computed is cached", ComputedScenarios.isCached), new Scenario("computed recomputes after flush", ComputedScenarios.recomputesAfterFlush), new Scenario("diamond is glitch-free", ComputedScenarios.diamondIsGlitchFree), new Scenario("equal result stops propagation", ComputedScenarios.equalResultStopsPropagation), new Scenario("dynamic dependency is dropped", ComputedScenarios.dynamicDependencyIsDropped), new Scenario("write inside compute throws", ComputedScenarios.writeInsideComputeThrows), new Scenario("nested dirty check walks branching dependencies", ComputedScenarios.nestedDirtyCheck)];

  constructor() { }

  private static isLazy(expect: IExpect): void {
    let runs = 0;
    const computed = new Computed(() => {
      runs = (runs + 1) | 0;

      return 1;
    });
    expect.equal(0, runs, "runs before the first read");
    expect.equal(1, computed.value, "first read");
    expect.equal(1, runs, "runs after the first read");
  }

  private static isCached(expect: IExpect): void {
    let runs = 0;
    const count = new Signal(3);
    const doubled = new Computed(() => {
      runs = (runs + 1) | 0;

      return Math.imul(count.value, 2);
    });
    expect.equal(6, doubled.value, "first read");
    expect.equal(6, doubled.value, "second read");
    expect.equal(1, runs, "runs after two reads");
  }

  private static recomputesAfterFlush(expect: IExpect): void {
    let runs = 0;
    const count = new Signal(1);
    const doubled = new Computed(() => {
      runs = (runs + 1) | 0;

      return Math.imul(count.value, 2);
    });
    expect.equal(2, doubled.value, "initial value");
    count.value = 5;
    Reactivity.flush();
    expect.equal(10, doubled.value, "value after flush");
    expect.equal(2, runs, "runs after flush");
  }

  private static diamondIsGlitchFree(expect: IExpect): void {
    const seen = new List<number>();
    const a = new Signal(0);
    const b = new Computed(() => (a.value + 1) | 0);
    const c = new Computed(() => Math.imul(a.value, 2));
    const d = new Computed(() => {
      const sum = (b.value + c.value) | 0;
      seen.add(sum);

      return sum;
    });
    expect.equal(1, d.value, "initial value");
    a.value = 2;
    Reactivity.flush();
    expect.equal(7, d.value, "value after flush");
    expect.equal(2, seen.count, "values seen by d");
    expect.equal(1, seen.get(0), "first value seen by d");
    expect.equal(7, seen.get(1), "second value seen by d");
  }

  private static equalResultStopsPropagation(expect: IExpect): void {
    let downstreamRuns = 0;
    const count = new Signal(0);
    const parity = new Computed(() => count.value % 2);
    const downstream = new Computed(() => {
      downstreamRuns = (downstreamRuns + 1) | 0;

      return Math.imul(parity.value, 10);
    });
    expect.equal(0, downstream.value, "initial value");
    count.value = 2;
    Reactivity.flush();
    expect.equal(0, downstream.value, "value after an equal parity");
    expect.equal(1, downstreamRuns, "downstream runs");
  }

  private static dynamicDependencyIsDropped(expect: IExpect): void {
    let runs = 0;
    const flag = new Signal(true);
    const a = new Signal(1);
    const b = new Signal(2);
    const pick = new Computed(() => {
      runs = (runs + 1) | 0;

      return flag.value ? a.value : b.value;
    });
    expect.equal(1, pick.value, "picks a");
    flag.value = false;
    Reactivity.flush();
    expect.equal(2, pick.value, "picks b");
    expect.equal(2, runs, "runs after switching to b");
    a.value = 10;
    Reactivity.flush();
    expect.equal(2, pick.value, "still picks b");
    expect.equal(2, runs, "runs after writing the dropped dependency");
  }

  private static writeInsideComputeThrows(expect: IExpect): void {
    const target = new Signal(0);
    const writer = new Computed(() => {
      target.value = 1;

      return 0;
    });
    const error = ScenarioRunner.catch(() => {
      const value = writer.value;
    });
    expect.isTrue(error instanceof InvalidOperationException, "reading a writing computed throws");
  }

  private static nestedDirtyCheck(expect: IExpect): void {
    const source = new Signal(1);
    const plusOne = new Computed(() => (source.value + 1) | 0);
    const twice = new Computed(() => Math.imul(source.value, 2));
    const sum = new Computed(() => (plusOne.value + twice.value) | 0);
    const outer = new Computed(() => sum.value);
    const inner = new Computed(() => (source.value + outer.value) | 0);
    const middle = new Computed(() => inner.value);
    const top = new Computed(() => (middle.value + 1) | 0);
    expect.equal(6, top.value, "initial value");
    source.value = 2;
    Reactivity.flush();
    expect.equal(10, top.value, "value after flush");
    expect.equal(7, outer.value, "outer after flush");
  }
}
