import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { El } from "../../core/el.js";
import { bindTo, onClick } from "./bindings.js";
import { Component } from "./component.js";
import { DirectBuilders } from "./direct-builders.js";

let CounterH$rt: ClassType<CounterH> | undefined;

export class CounterH extends Component<CounterH> {
  declare start: number;

  constructor() {
    super();
    this.start = 0;
  }

  static override get $runtimeType(): ClassType<CounterH> {
    return (CounterH$rt ??= {
      kind: "class",
      name: "CounterH",
      fullName: "Metanui.Spike.Dsl.Variants.Direct.CounterH",
      namespace: "Metanui.Spike.Dsl.Variants.Direct",
      ctor: CounterH,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new CounterH(),
      test: (v: unknown): v is CounterH => v instanceof CounterH,
    });
  }

  static counterBox(build: (obj: CounterH) => void): El {
    return DirectBuilders.mount(new CounterH(), build);
  }

  override render(content: El): El {
    const count = Reactivity.signal(this.start);

    return DirectBuilders.div((row) => {
      DirectBuilders.p((p) => bindTo(count, (value: number) => p.textContent = `Count: ${value} (Start = ${this.start})`));
      DirectBuilders.button((button) => {
        button.textContent = "+1";
        onClick(button, () => count.value = (count.value + 1) | 0);
      });
    });
  }
}
