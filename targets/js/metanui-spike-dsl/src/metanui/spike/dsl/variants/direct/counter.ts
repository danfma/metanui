import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { El } from "../../core/el.js";
import { bindWrite, onClick } from "./bindings.js";
import { Component } from "./component.js";
import { DirectBuilders } from "./direct-builders.js";

let Counter$rt: ClassType<Counter> | undefined;

export class Counter extends Component<Counter> {
  static live: number = 0;
  declare label: string;
  declare onRemove: () => void;

  constructor() {
    super();
    this.label = "";
    this.onRemove = () => {
    };
  }

  static override get $runtimeType(): ClassType<Counter> {
    return (Counter$rt ??= {
      kind: "class",
      name: "Counter",
      fullName: "Metanui.Spike.Dsl.Variants.Direct.Counter",
      namespace: "Metanui.Spike.Dsl.Variants.Direct",
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

  static create(build: (obj: Counter) => void): El {
    return DirectBuilders.mount(new Counter(), build);
  }

  override render(content: El): El {
    const count = Reactivity.signal(0);
    Counter.live = (Counter.live + 1) | 0;
    Reactivity.onCleanup(() => Counter.live = (Counter.live - 1) | 0);

    return DirectBuilders.div((row) => {
      row.className = "counter-row";
      DirectBuilders.span((label) => bindWrite(() => label.textContent = `${this.label}: ${count.value} `));
      DirectBuilders.button((minus) => {
        minus.textContent = "-1";
        onClick(minus, () => count.value = (count.value - 1) | 0);
      });
      DirectBuilders.button((plus) => {
        plus.textContent = "+1";
        onClick(plus, () => count.value = (count.value + 1) | 0);
      });
      DirectBuilders.button((remove) => {
        remove.textContent = "remove";
        onClick(remove, () => this.onRemove());
      });
    });
  }
}
