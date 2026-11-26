import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { Attributes } from "../core/attributes.js";
import { Elements } from "../core/elements.js";
import { Part } from "../core/part.js";
import { Badge } from "./badge.js";
import { bind } from "./bind-extensions.js";
import { BindingComponent } from "./binding-component.js";
import { Setter } from "./setter.js";

let GroupedBindCounter$rt: ClassType<GroupedBindCounter> | undefined;

export class GroupedBindCounter extends BindingComponent {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<GroupedBindCounter> {
    return (GroupedBindCounter$rt ??= {
      kind: "class",
      name: "GroupedBindCounter",
      fullName: "Metanui.Spike.Dsl.Variants.GroupedBindCounter",
      namespace: "Metanui.Spike.Dsl.Variants",
      ctor: GroupedBindCounter,
      base: () => BindingComponent.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new GroupedBindCounter(),
      test: (v: unknown): v is GroupedBindCounter => v instanceof GroupedBindCounter,
    });
  }

  override render(): Part {
    const count = Reactivity.signal(0);

    return Elements.section(Attributes.classString("variant"), Elements.h2(Part.__implicitFromString("F. Grouped Bind")), BindingComponent.bind(Elements.p(), () => [Setter.textContent(`Count: ${count.value}`)]), bind(Elements.p(), () => [Setter.textContent("parity"), Setter.className(count.value % 2 === 0 ? "even" : "odd")]), Elements.button(Attributes.onClick(() => count.value = (count.value - 1) | 0), Part.__implicitFromString("-1")), Elements.button(Attributes.onClick(() => count.value = (count.value + 1) | 0), Part.__implicitFromString("+1")), new Badge(() => count.value > 5 ? "big" : "small"));
  }
}
