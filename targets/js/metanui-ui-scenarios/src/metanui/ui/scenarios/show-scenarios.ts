import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Scenario, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import type { FakeElement } from "./fakes/fake-element.js";
import { FakeHost } from "./fakes/fake-host.js";
import { FakeViews } from "./fakes/fake-views.js";

export class ShowScenarios {
  static readonly all: Scenario[] = [new Scenario("show renders the active branch and disposes the hidden one", ShowScenarios.showRendersTheActiveBranchAndDisposesTheHiddenOne), new Scenario("show keeps its branch while the condition result is unchanged", ShowScenarios.showKeepsItsBranchWhileTheConditionResultIsUnchanged), new Scenario("show without otherwise renders nothing when false", ShowScenarios.showWithoutOtherwiseRendersNothingWhenFalse), new Scenario("a branch that throws inside a boundary moves and hides with its region", ShowScenarios.aBranchThatThrowsInsideABoundaryMovesAndHidesWithItsRegion)];

  private constructor() { }

  private static showRendersTheActiveBranchAndDisposesTheHiddenOne(expect: IExpect): void {
    const host = new FakeHost();
    const on = Reactivity.signal(true);
    const count = Reactivity.signal(0);
    let disposals = 0;
    host.render(() => {
      FakeViews.labelText("before");
      View.show(() => on.value, () => {
        Reactivity.onCleanup(() => disposals = (disposals + 1) | 0);
        FakeViews.labelBuild((label: FakeElement) => View.bindWrite(() => label.text = `on ${count.value}`));
      }, () => FakeViews.labelText("off"));
      FakeViews.labelText("after");
    });
    expect.equal("label\"before\" label\"on 0\" label\"after\"", host.print(), "on");
    on.value = false;
    Reactivity.flush();
    expect.equal("label\"before\" label\"off\" label\"after\"", host.print(), "off");
    expect.equal(1, disposals, "the hidden branch is disposed");
    count.value = 1;
    on.value = true;
    Reactivity.flush();
    expect.equal("label\"before\" label\"on 1\" label\"after\"", host.print(), "on again");
    expect.equal(4, host.container.childCount, "three labels and the end anchor");
  }

  private static showKeepsItsBranchWhileTheConditionResultIsUnchanged(expect: IExpect): void {
    const host = new FakeHost();
    const count = Reactivity.signal(1);
    let renders = 0;
    host.render(() => View.show(() => count.value > 0, () => {
      renders = (renders + 1) | 0;
      FakeViews.labelText("positive");
    }));
    count.value = 2;
    Reactivity.flush();
    expect.equal(1, renders, "an unchanged condition keeps the branch");
  }

  private static aBranchThatThrowsInsideABoundaryMovesAndHidesWithItsRegion(expect: IExpect): void {
    const host = new FakeHost();
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    const on = Reactivity.signal(false);
    const errors = new List<string>();
    Reactivity.errorBoundary(() => host.render(() => View.forItemsRender<string>(() => items.value, (item: string) => {
      FakeViews.labelText(item);
      View.show(() => on.value, () => ShowScenarios.showMarked(item));
    })), (error: Exception) => errors.add(error.message));
    on.value = true;
    Reactivity.flush();
    expect.equal("boom", [...errors].join(","), "routed to the boundary");
    items.value = List.adopt<string>(["b", "a"], { fixedSize: true });
    Reactivity.flush();
    expect.equal("label\"b\" label\"b!\" label\"a\" label\"a!\"", host.print(), "the partial branch moved with its item");
    on.value = false;
    Reactivity.flush();
    expect.equal("label\"b\" label\"a\"", host.print(), "both branches hidden");
  }

  private static showMarked(item: string): void {
    FakeViews.labelText(`${item}!`);

    if (item === "a") {
      throw new InvalidOperationException("boom");
    }
  }

  private static showWithoutOtherwiseRendersNothingWhenFalse(expect: IExpect): void {
    const host = new FakeHost();
    const on = Reactivity.signal(false);
    host.render(() => View.show(() => on.value, () => FakeViews.labelText("on")));
    expect.equal("", host.print(), "off");
    on.value = true;
    Reactivity.flush();
    expect.equal("label\"on\"", host.print(), "on");
  }
}
