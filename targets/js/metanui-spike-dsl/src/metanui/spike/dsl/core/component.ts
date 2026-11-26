import type { ClassType } from "metano-runtime";
import type { HTMLElement } from "metanui-spike-counter/metanui/spike/counter/dom";
import { Part } from "./part.js";

let Component$rt: ClassType<Component> | undefined;

export abstract class Component extends Part {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<Component> {
    return (Component$rt ??= {
      kind: "class",
      name: "Component",
      fullName: "Metanui.Spike.Dsl.Core.Component",
      namespace: "Metanui.Spike.Dsl.Core",
      ctor: Component,
      base: () => Part.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is Component => v instanceof Component,
    });
  }

  abstract render(): Part;

  override attachTo(parent: HTMLElement): void {
    this.render().attachTo(parent);
  }
}
