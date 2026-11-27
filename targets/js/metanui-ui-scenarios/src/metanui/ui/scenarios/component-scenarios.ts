import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { Scenario, ScenarioRunner, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import { Frame } from "./components/frame.js";
import { StartCounter } from "./components/start-counter.js";
import { TitledCard } from "./components/titled-card.js";
import { ExpectedUiMessages } from "./expected-ui-messages.js";
import { FakeHost } from "./fakes/fake-host.js";
import { FakeViews } from "./fakes/fake-views.js";

export class ComponentScenarios {
  static readonly all: Scenario[] = [new Scenario("signal-backed prop takes a static value or a split bind", ComponentScenarios.signalBackedPropTakesAStaticValueOrASplitBind), new Scenario("plain prop is init-only: a split bind to it is lost", ComponentScenarios.plainPropIsInitOnly), new Scenario("content lands inside the component's element", ComponentScenarios.contentLandsInsideTheComponentsElement), new Scenario("content of a component without an element lands between its siblings", ComponentScenarios.contentOfAComponentWithoutAnElementLandsBetweenItsSiblings), new Scenario("an element created in the props lambda throws", ComponentScenarios.anElementCreatedInThePropsLambdaThrows), new Scenario("a signal-backed prop assigned inside a For item throws", ComponentScenarios.aSignalBackedPropAssignedInsideAForItemThrows)];

  private constructor() { }

  private static signalBackedPropTakesAStaticValueOrASplitBind(expect: IExpect): void {
    const host = new FakeHost();
    const name = Reactivity.signal("Ada");
    host.render(() => {
      TitledCard.card((card: TitledCard) => card.title = "Static");
      TitledCard.card((card: TitledCard) => View.bindComputeApply<string>(() => name.value, (value: string) => card.title = value));
    });
    Reactivity.flush();
    expect.equal("box\"card\"(label\"Static\") box\"card\"(label\"Ada\")", host.print(), "after the first flush");
    name.value = "Grace";
    Reactivity.flush();
    expect.equal("box\"card\"(label\"Static\") box\"card\"(label\"Grace\")", host.print(), "after the change");
  }

  private static plainPropIsInitOnly(expect: IExpect): void {
    const host = new FakeHost();
    const start = Reactivity.signal(5);
    host.render(() => {
      StartCounter.counter((counter: StartCounter) => counter.start = 7);
      StartCounter.counter((counter: StartCounter) => View.bindComputeApply<number>(() => start.value, (value: number) => counter.start = value));
    });
    Reactivity.flush();
    expect.equal("label\"start=7\" label\"start=0\"", host.print(), "the bound value is lost");
  }

  private static contentLandsInsideTheComponentsElement(expect: IExpect): void {
    const host = new FakeHost();
    host.render(() => TitledCard.card((card: TitledCard) => {
      card.title = "T";
      card.content = () => {
        FakeViews.labelText("one");
        FakeViews.labelText("two");
      };
    }));
    Reactivity.flush();
    expect.equal("box\"card\"(label\"T\" label\"one\" label\"two\")", host.print(), "tree");
  }

  private static contentOfAComponentWithoutAnElementLandsBetweenItsSiblings(expect: IExpect): void {
    const host = new FakeHost();
    host.render(() => {
      FakeViews.labelText("first");
      Frame.framed((frame: Frame) => frame.content = () => FakeViews.labelText("inside"));
      FakeViews.labelText("last");
    });
    expect.equal("label\"first\" label\"before\" label\"inside\" label\"after\" label\"last\"", host.print(), "no wrapper element");
    expect.equal(5, host.container.childCount, "no extra node");
  }

  private static anElementCreatedInThePropsLambdaThrows(expect: IExpect): void {
    const host = new FakeHost();
    let error = null as Exception | null;
    host.render(() => {
      error = ScenarioRunner.catch(() => TitledCard.card((card: TitledCard) => FakeViews.labelText("child")));
      FakeViews.labelText("next");
    });
    expect.equal(ExpectedUiMessages.childrenGoInContent, error?.message ?? null, "error");
    expect.equal("label\"next\"", host.print(), "the scope is restored");
  }

  private static aSignalBackedPropAssignedInsideAForItemThrows(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a"], { fixedSize: true }));
    const error = ScenarioRunner.catch(() => host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => TitledCard.card((card: TitledCard) => card.title = item))));
    expect.equal(ExpectedUiMessages.signalWriteInComputation, error?.message ?? null, "error");
  }
}
