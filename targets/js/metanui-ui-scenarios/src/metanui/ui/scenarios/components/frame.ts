import type { ClassType } from "metano-runtime";
import { Component, View } from "metanui-ui/metanui/ui";
import { FakeViews } from "../fakes/fake-views.js";

let Frame$rt: ClassType<Frame> | undefined;

export class Frame extends Component<Frame> {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<Frame> {
    return (Frame$rt ??= {
      kind: "class",
      name: "Frame",
      fullName: "Metanui.Ui.Scenarios.Components.Frame",
      namespace: "Metanui.Ui.Scenarios.Components",
      ctor: Frame,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new Frame(),
      test: (v: unknown): v is Frame => v instanceof Frame,
    });
  }

  static create(build: (obj: Frame) => void): void {
    View.mount(new Frame(), build);
  }

  override render(): void {
    FakeViews.labelText("before");
    this.content?.();
    FakeViews.labelText("after");
  }
}
