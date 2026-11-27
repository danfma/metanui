import type { ClassType } from "metano-runtime";
import { Component, View } from "metanui-ui/metanui/ui";
import type { FakeElement } from "../fakes/fake-element.js";
import { FakeViews } from "../fakes/fake-views.js";

let StartCounter$rt: ClassType<StartCounter> | undefined;

export class StartCounter extends Component<StartCounter> {
  declare start: number;

  constructor() {
    super();
    this.start = 0;
  }

  static override get $runtimeType(): ClassType<StartCounter> {
    return (StartCounter$rt ??= {
      kind: "class",
      name: "StartCounter",
      fullName: "Metanui.Ui.Scenarios.Components.StartCounter",
      namespace: "Metanui.Ui.Scenarios.Components",
      ctor: StartCounter,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new StartCounter(),
      test: (v: unknown): v is StartCounter => v instanceof StartCounter,
    });
  }

  static counter(build: (obj: StartCounter) => void): void {
    View.mount(new StartCounter(), build);
  }

  override render(): void {
    FakeViews.labelBuild((label: FakeElement) => label.text = `start=${this.start}`);
  }
}
