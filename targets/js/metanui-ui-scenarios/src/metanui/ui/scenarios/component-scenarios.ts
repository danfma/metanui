import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { Scenario, ScenarioRunner, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Prop, View } from "metanui-ui/metanui/ui";
import { Card } from "./components/card.js";
import { Counter } from "./components/counter.js";
import { Frame } from "./components/frame.js";
import { ExpectedUiMessages } from "./expected-ui-messages.js";
import { FakeHost } from "./fakes/fake-host.js";
import { FakeViews } from "./fakes/fake-views.js";

export class ComponentScenarios {
  static readonly all: Scenario[] = [new Scenario("a prop takes a static value or a live reader", ComponentScenarios.aPropTakesAStaticValueOrALiveReader), new Scenario("a bind in the props lambda throws", ComponentScenarios.aBindInThePropsLambdaThrows), new Scenario("content lands inside the component's element", ComponentScenarios.contentLandsInsideTheComponentsElement), new Scenario("content of a component without an element lands between its siblings", ComponentScenarios.contentOfAComponentWithoutAnElementLandsBetweenItsSiblings), new Scenario("an element created in the props lambda throws", ComponentScenarios.anElementCreatedInThePropsLambdaThrows), new Scenario("a prop assigned inside a For item and a Show branch works", ComponentScenarios.aPropAssignedInsideAForItemAndAShowBranchWorks), new Scenario("a live prop in a Show branch is bound again when the branch comes back", ComponentScenarios.aLivePropInAShowBranchIsBoundAgainWhenTheBranchComesBack)];

  private constructor() { }

  private static aPropTakesAStaticValueOrALiveReader(expect: IExpect): void {
    const host = new FakeHost();
    const name = Reactivity.signal("Ada");
    host.render(() => {
      Card.create((card: Card) => card.title = Prop.__implicitFromT("Static"));
      Card.create((card: Card) => card.title = View.live(() => name.value));
    });
    expect.equal("box\"card\"(label\"Static\") box\"card\"(label\"Ada\")", host.print(), "before any flush");
    name.value = "Grace";
    Reactivity.flush();
    expect.equal("box\"card\"(label\"Static\") box\"card\"(label\"Grace\")", host.print(), "after the change");
  }

  private static aBindInThePropsLambdaThrows(expect: IExpect): void {
    const host = new FakeHost();
    const name = Reactivity.signal("Ada");
    const start = Reactivity.signal(5);
    let propError = null as Exception | null;
    let plainError = null as Exception | null;
    host.render(() => {
      propError = ScenarioRunner.catch(() => Card.create((card: Card) => View.bindWrite(() => card.title = Prop.__implicitFromT(name.value))));
      plainError = ScenarioRunner.catch(() => Counter.create((counter: Counter) => View.bindComputeApply<number>(() => start.value, (value: number) => counter.start = value)));
      FakeViews.labelText("next");
    });
    expect.equal(ExpectedUiMessages.bindingInPropsLambda, propError?.message ?? null, "prop");
    expect.equal(ExpectedUiMessages.bindingInPropsLambda, plainError?.message ?? null, "plain property");
    expect.equal("label\"next\"", host.print(), "the scope is restored");
  }

  private static contentLandsInsideTheComponentsElement(expect: IExpect): void {
    const host = new FakeHost();
    host.render(() => Card.create((card: Card) => {
      card.title = Prop.__implicitFromT("T");
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
      Frame.create((frame: Frame) => frame.content = () => FakeViews.labelText("inside"));
      FakeViews.labelText("last");
    });
    expect.equal("label\"first\" label\"before\" label\"inside\" label\"after\" label\"last\"", host.print(), "no wrapper element");
    expect.equal(5, host.container.childCount, "no extra node");
  }

  private static anElementCreatedInThePropsLambdaThrows(expect: IExpect): void {
    const host = new FakeHost();
    let error = null as Exception | null;
    host.render(() => {
      error = ScenarioRunner.catch(() => Card.create((card: Card) => FakeViews.labelText("child")));
      FakeViews.labelText("next");
    });
    expect.equal(ExpectedUiMessages.childrenGoInContent, error?.message ?? null, "error");
    expect.equal("label\"next\"", host.print(), "the scope is restored");
  }

  private static aPropAssignedInsideAForItemAndAShowBranchWorks(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a"], { fixedSize: true }));
    const suffix = Reactivity.signal("!");
    host.render(() => {
      View.forItemsRender<string>(() => items.value, (item: string) => {
        Card.create((card: Card) => card.title = Prop.__implicitFromT(item));
        Card.create((card: Card) => card.title = View.live(() => item + suffix.value));
      });
      View.show(() => true, () => {
        Card.create((card: Card) => card.title = Prop.__implicitFromT("shown"));
        Card.create((card: Card) => card.title = View.live(() => "shown" + suffix.value));
      });
    });
    expect.equal("box\"card\"(label\"a\") box\"card\"(label\"a!\") " + "box\"card\"(label\"shown\") box\"card\"(label\"shown!\")", host.print(), "initial");
    suffix.value = "?";
    Reactivity.flush();
    expect.equal("box\"card\"(label\"a\") box\"card\"(label\"a?\") " + "box\"card\"(label\"shown\") box\"card\"(label\"shown?\")", host.print(), "after the change");
  }

  private static aLivePropInAShowBranchIsBoundAgainWhenTheBranchComesBack(expect: IExpect): void {
    const host = new FakeHost();
    const on = Reactivity.signal(true);
    const name = Reactivity.signal("Ada");
    host.render(() => View.show(() => on.value, () => Card.create((card: Card) => card.title = View.live(() => name.value))));
    expect.equal("box\"card\"(label\"Ada\")", host.print(), "on");
    on.value = false;
    Reactivity.flush();
    name.value = "Grace";
    Reactivity.flush();
    expect.equal("", host.print(), "off");
    on.value = true;
    Reactivity.flush();
    expect.equal("box\"card\"(label\"Grace\")", host.print(), "on again");
    name.value = "Ada";
    Reactivity.flush();
    expect.equal("box\"card\"(label\"Ada\")", host.print(), "re-bound");
  }
}
