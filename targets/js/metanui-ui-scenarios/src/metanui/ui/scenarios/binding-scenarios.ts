import type { IDisposable } from "metano-runtime";
import { Scenario, ScenarioRunner, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import { ExpectedUiMessages } from "./expected-ui-messages.js";
import type { FakeElement } from "./fakes/fake-element.js";
import { FakeHost } from "./fakes/fake-host.js";
import { FakeViews } from "./fakes/fake-views.js";

export class BindingScenarios {
  static readonly all: Scenario[] = [new Scenario("fused bind writes now and on every change", BindingScenarios.fusedBindWritesNowAndOnEveryChange), new Scenario("split bind writes in the apply and skips equal values", BindingScenarios.splitBindWritesInTheApplyAndSkipsEqualValues), new Scenario("a signal write in a fused bind throws", BindingScenarios.aSignalWriteInAFusedBindThrows), new Scenario("dynamic text follows its source", BindingScenarios.dynamicTextFollowsItsSource), new Scenario("disposing a bind stops its writes", BindingScenarios.disposingABindStopsItsWrites)];

  private constructor() { }

  private static fusedBindWritesNowAndOnEveryChange(expect: IExpect): void {
    const host = new FakeHost();
    const count = Reactivity.signal(0);
    host.render(() => FakeViews.labelBuild((label: FakeElement) => View.bindWrite(() => label.text = `n=${count.value}`)));
    expect.equal("label\"n=0\"", host.print(), "written at once, before any flush");
    count.value = 1;
    Reactivity.flush();
    expect.equal("label\"n=1\"", host.print(), "after the change");
  }

  private static splitBindWritesInTheApplyAndSkipsEqualValues(expect: IExpect): void {
    const host = new FakeHost();
    const count = Reactivity.signal(0);
    let writes = 0;
    host.render(() => FakeViews.labelBuild((label: FakeElement) => View.bindComputeApply<string>(() => count.value >= 0 ? "non-negative" : "negative", (sign: string) => {
      writes = (writes + 1) | 0;
      label.text = sign;
    })));
    expect.equal("label", host.print(), "nothing written before the flush");
    Reactivity.flush();
    expect.equal("label\"non-negative\"", host.print(), "first apply");
    count.value = 2;
    Reactivity.flush();
    expect.equal(1, writes, "an equal value is not written again");
    count.value = -1;
    Reactivity.flush();
    expect.equal("label\"negative\"", host.print(), "a different value is written");
    expect.equal(2, writes, "writes");
  }

  private static aSignalWriteInAFusedBindThrows(expect: IExpect): void {
    const target = Reactivity.signal(0);
    const error = ScenarioRunner.catch(() => View.bindWrite(() => target.value = 1));
    expect.equal(ExpectedUiMessages.signalWriteInComputation, error?.message ?? null, "error");
  }

  private static dynamicTextFollowsItsSource(expect: IExpect): void {
    const host = new FakeHost();
    const count = Reactivity.signal(0);
    host.render(() => FakeViews.box((box: FakeElement) => View.textFuncOfString(() => `c=${count.value}`)));
    expect.equal("box('c=0')", host.print(), "initial");
    count.value = 1;
    Reactivity.flush();
    expect.equal("box('c=1')", host.print(), "after the change");
  }

  private static disposingABindStopsItsWrites(expect: IExpect): void {
    const host = new FakeHost();
    const count = Reactivity.signal(0);
    let binding = null as IDisposable | null;
    host.render(() => FakeViews.labelBuild((label: FakeElement) => binding = View.bindWrite(() => label.text = `n=${count.value}`)));
    binding?.dispose();
    count.value = 1;
    Reactivity.flush();
    expect.equal("label\"n=0\"", host.print(), "unchanged after the disposal");
  }
}
