import type { ClassType } from "metano-runtime";

let Component$rt: ClassType<Component<unknown>> | undefined;

export abstract class Component<TSelf extends Component<TSelf>> {
  declare content: (() => void) | null;

  constructor() {
    this.content = null;
  }

  static get $runtimeType(): ClassType<Component<unknown>> {
    return (Component$rt ??= {
      kind: "class",
      name: "Component`1",
      fullName: "Metanui.Ui.Component`1",
      namespace: "Metanui.Ui",
      ctor: Component,
      interfaces: [],
      typeParameters: ["TSelf"],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is Component<unknown> => v instanceof Component,
    });
  }

  abstract render(): void;
}
