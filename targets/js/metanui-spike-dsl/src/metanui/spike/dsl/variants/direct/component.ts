import type { ClassType } from "metano-runtime";
import type { El } from "../../core/el.js";

let Component$rt: ClassType<Component<unknown>> | undefined;

export abstract class Component<TSelf extends Component<TSelf>> {
  static get $runtimeType(): ClassType<Component<unknown>> {
    return (Component$rt ??= {
      kind: "class",
      name: "Component`1",
      fullName: "Metanui.Spike.Dsl.Variants.Direct.Component`1",
      namespace: "Metanui.Spike.Dsl.Variants.Direct",
      ctor: Component,
      interfaces: [],
      typeParameters: ["TSelf"],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is Component<unknown> => v instanceof Component,
    });
  }

  abstract render(content: El): El;
}
