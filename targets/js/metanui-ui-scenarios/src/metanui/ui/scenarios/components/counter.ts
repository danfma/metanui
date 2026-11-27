import type { ClassType } from "metano-runtime";
import { Component } from "metanui-ui/metanui/ui";
import type { FakeElement } from "../fakes/fake-element.js";
import { FakeViews } from "../fakes/fake-views.js";

let Counter$rt: ClassType<Counter> | undefined;

export class Counter extends Component<Counter> {
  declare start: number;

  constructor() {
    super();
    this.start = 0;
  }

  static override get $runtimeType(): ClassType<Counter> {
    return (Counter$rt ??= {
      kind: "class",
      name: "Counter",
      fullName: "Metanui.Ui.Scenarios.Components.Counter",
      namespace: "Metanui.Ui.Scenarios.Components",
      ctor: Counter,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new Counter(),
      test: (v: unknown): v is Counter => v instanceof Counter,
    });
  }

  override render(): void {
    FakeViews.labelBuild((label: FakeElement) => label.text = `start=${this.start}`);
  }
}
