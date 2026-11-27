import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { button, div, onClick, span } from "metanui-ui-web/metanui/ui/web";
import { Component, Prop, View } from "metanui-ui/metanui/ui";

let Counter$rt: ClassType<Counter> | undefined;

export class Counter extends Component<Counter> {
  declare label: Prop<string>;
  declare onRemove: (() => void) | null;

  constructor() {
    super();
    this.label = Prop.__implicitFromT("");
    this.onRemove = null;
  }

  static override get $runtimeType(): ClassType<Counter> {
    return (Counter$rt ??= {
      kind: "class",
      name: "Counter",
      fullName: "Metanui.Samples.Counter.Counter",
      namespace: "Metanui.Samples.Counter",
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

  static create(build: (obj: Counter) => void): void {
    View.mount(new Counter(), build);
  }

  override render(): void {
    const count = Reactivity.signal(0);
    const onRemove = this.onRemove;
    div((row) => {
      row.className = "counter";
      span((label) => View.bindWrite(() => label.textContent = `${this.label.value}: ${count.value}`));
      button((minus) => {
        minus.textContent = "-1";
        onClick(minus, () => count.update((c: number) => (c - 1) | 0));
      });
      button((plus) => {
        plus.textContent = "+1";
        onClick(plus, () => count.update((c: number) => (c + 1) | 0));
      });

      if (onRemove != null) {
        button((remove) => {
          remove.textContent = "remove";
          onClick(remove, onRemove);
        });
      }
    });
  }
}
