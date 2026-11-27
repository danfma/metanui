import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Scenario, ScenarioRunner, type IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { View } from "metanui-ui/metanui/ui";
import type { FakeElement } from "./fakes/fake-element.js";
import { FakeHost } from "./fakes/fake-host.js";
import { FakeViews } from "./fakes/fake-views.js";

export class RenderScenarios {
  static readonly all: Scenario[] = [new Scenario("disposing the render removes every node and stops the tree", RenderScenarios.disposingTheRenderRemovesEveryNodeAndStopsTheTree), new Scenario("a render that throws leaves no node behind", RenderScenarios.aRenderThatThrowsLeavesNoNodeBehind)];

  private constructor() { }

  private static disposingTheRenderRemovesEveryNodeAndStopsTheTree(expect: IExpect): void {
    const host = new FakeHost();
    const count = Reactivity.signal(0);
    const items = Reactivity.signal<IReadOnlyList<string>>(List.adopt<string>(["a", "b"], { fixedSize: true }));
    let writes = 0;
    let cleanups = 0;
    const view = host.render(() => {
      Reactivity.onCleanup(() => cleanups = (cleanups + 1) | 0);
      FakeViews.box((box: FakeElement) => View.bindWrite(() => {
        writes = (writes + 1) | 0;
        box.text = `${count.value}`;
      }));
      View.textString("text");
      View.forItemsRender<string>(() => items.value, (item: string) => FakeViews.labelText(item));
      View.show(() => count.value >= 0, () => FakeViews.labelText("shown"));
    });
    view.dispose();
    count.value = 1;
    Reactivity.flush();
    expect.equal(0, host.container.childCount, "no node left, anchors included");
    expect.equal(1, cleanups, "the tree is disposed");
    expect.equal(1, writes, "no binding runs after the disposal");
  }

  private static aRenderThatThrowsLeavesNoNodeBehind(expect: IExpect): void {
    const host = new FakeHost();
    const error = ScenarioRunner.catch(() => host.render(() => {
      FakeViews.labelText("a");
      throw new InvalidOperationException("boom");
    }));
    expect.equal("boom", error?.message ?? null, "error");
    expect.equal(0, host.container.childCount, "no node left");
  }
}
