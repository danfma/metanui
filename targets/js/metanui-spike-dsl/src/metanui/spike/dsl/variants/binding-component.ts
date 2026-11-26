import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Component } from "../core/component.js";
import type { El } from "../core/el.js";
import type { Setter } from "./setter.js";

let BindingComponent$rt: ClassType<BindingComponent> | undefined;

export abstract class BindingComponent extends Component {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<BindingComponent> {
    return (BindingComponent$rt ??= {
      kind: "class",
      name: "BindingComponent",
      fullName: "Metanui.Spike.Dsl.Variants.BindingComponent",
      namespace: "Metanui.Spike.Dsl.Variants",
      ctor: BindingComponent,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is BindingComponent => v instanceof BindingComponent,
    });
  }

  protected static bind(element: El, setters: () => Setter[]): El {
    Reactivity.effect(setters, (current: Setter[], previous: Setter[]) => {
      for (const setter of current) {
        setter.applyTo(element.node);
      }
    });

    return element;
  }
}
