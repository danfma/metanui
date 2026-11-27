import type { ClassType } from "metano-runtime";
import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import { linq, where } from "metano-runtime/system/linq";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { El } from "../../core/el.js";
import { bindWrite, onClick } from "./bindings.js";
import { Component } from "./component.js";
import { CounterEntry } from "./counter-entry.js";
import { Counter } from "./counter.js";
import { DirectBuilders } from "./direct-builders.js";

let CounterList$rt: ClassType<CounterList> | undefined;

export class CounterList extends Component<CounterList> {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<CounterList> {
    return (CounterList$rt ??= {
      kind: "class",
      name: "CounterList",
      fullName: "Metanui.Spike.Dsl.Variants.Direct.CounterList",
      namespace: "Metanui.Spike.Dsl.Variants.Direct",
      ctor: CounterList,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new CounterList(),
      test: (v: unknown): v is CounterList => v instanceof CounterList,
    });
  }

  static create(build: (obj: CounterList) => void): El {
    return DirectBuilders.mount(new CounterList(), build);
  }

  override render(content: El): El {
    let nextId = 1;
    const entries = Reactivity.signal<IReadOnlyList<CounterEntry>>(List.adopt<CounterEntry>([], { fixedSize: true }));

    return DirectBuilders.section((section) => {
      section.className = "variant";
      DirectBuilders.h2((heading) => heading.textContent = "H. CounterList");
      DirectBuilders.p((summary) => bindWrite(() => summary.textContent = `In list: ${entries.value.count}`));
      DirectBuilders.button((add) => {
        add.textContent = "Add counter";
        onClick(add, () => entries.value = List.adopt<CounterEntry>([...entries.value, new CounterEntry(((nextId = (nextId + 1) | 0) - 1) | 0)], { fixedSize: true }));
      });
      DirectBuilders.for(() => entries.value, (entry: CounterEntry) => entry.id, (entry: CounterEntry) => Counter.create((counter: Counter) => {
        counter.label = `#${entry.id}`;
        counter.onRemove = () => entries.value = List.adopt<CounterEntry>([...linq(entries.value, where((other: CounterEntry) => other.id !== entry.id))], { fixedSize: true });
      }));
    });
  }
}
