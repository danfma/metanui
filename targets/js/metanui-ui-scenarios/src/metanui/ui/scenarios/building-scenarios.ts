import { throwError } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Scenario, ScenarioRunner, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { View } from "metanui-ui/metanui/ui";
import { Builder } from "metanui-ui/metanui/ui/building";
import { ExpectedUiMessages } from "./expected-ui-messages.js";
import type { FakeElement } from "./fakes/fake-element.js";
import { FakeHost } from "./fakes/fake-host.js";
import { FakeText } from "./fakes/fake-text.js";
import { FakeViews } from "./fakes/fake-views.js";

export class BuildingScenarios {
  static readonly all: Scenario[] = [new Scenario("static tree is built in order", BuildingScenarios.staticTreeIsBuiltInOrder), new Scenario("adding a node outside a builder throws", BuildingScenarios.addingANodeOutsideABuilderThrows), new Scenario("builder scope is restored after a builder throws", BuildingScenarios.builderScopeIsRestoredAfterABuilderThrows)];

  private constructor() { }

  private static staticTreeIsBuiltInOrder(expect: IExpect): void {
    const host = new FakeHost();
    host.render(() => {
      FakeViews.box((outer: FakeElement) => {
        outer.text = "outer";
        FakeViews.labelText("a");
        FakeViews.box((inner: FakeElement) => FakeViews.labelText("b"));
        View.textString("hi");
      });
      FakeViews.labelText("c");
    });
    expect.equal("box\"outer\"(label\"a\" box(label\"b\") 'hi') label\"c\"", host.print(), "tree");
  }

  private static addingANodeOutsideABuilderThrows(expect: IExpect): void {
    const element = ScenarioRunner.catch(() => FakeViews.labelText("x"));
    const node = ScenarioRunner.catch(() => Builder.add(new FakeText("x")));
    const text = ScenarioRunner.catch(() => View.textString("x"));
    expect.equal(ExpectedUiMessages.noBuilder, element?.message ?? null, "element");
    expect.equal(ExpectedUiMessages.noBuilder, node?.message ?? null, "node");
    expect.equal(ExpectedUiMessages.noBuilder, text?.message ?? null, "text");
  }

  private static builderScopeIsRestoredAfterABuilderThrows(expect: IExpect): void {
    const host = new FakeHost();
    let error = null as Exception | null;
    host.render(() => {
      FakeViews.box((outer: FakeElement) => {
        error = ScenarioRunner.catch(() => FakeViews.box((inner: FakeElement) => throwError(new InvalidOperationException("boom"))));
        FakeViews.labelText("kept");
      });
    });
    const outside = ScenarioRunner.catch(() => FakeViews.labelText("x"));
    expect.equal("boom", error?.message ?? null, "error");
    expect.equal("box(label\"kept\")", host.print(), "tree");
    expect.equal(ExpectedUiMessages.noBuilder, outside?.message ?? null, "outside");
  }
}
