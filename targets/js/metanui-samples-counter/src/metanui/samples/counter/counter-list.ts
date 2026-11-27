import type { ClassType } from "metano-runtime";
import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import { linq, where } from "metano-runtime/system/linq";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { button, h2, onClick, p, section } from "metanui-ui-web/metanui/ui/web";
import { Component, Prop, View } from "metanui-ui/metanui/ui";
import { CounterEntry } from "./counter-entry.js";
import { Counter } from "./counter.js";

let CounterList$rt: ClassType<CounterList> | undefined;

export class CounterList extends Component<CounterList> {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<CounterList> {
    return (CounterList$rt ??= {
      kind: "class",
      name: "CounterList",
      fullName: "Metanui.Samples.Counter.CounterList",
      namespace: "Metanui.Samples.Counter",
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

  static create(build: (obj: CounterList) => void): void {
    View.mount(new CounterList(), build);
  }

  override render(): void {
    let nextId = 1;
    const entries = Reactivity.signal<IReadOnlyList<CounterEntry>>(List.adopt<CounterEntry>([], { fixedSize: true }));
    section((section) => {
      section.className = "counter-list";
      h2((heading) => heading.textContent = "Counters");
      p((summary) => View.bindWrite(() => summary.textContent = `In list: ${entries.value.count}`));
      button((add) => {
        add.textContent = "Add counter";
        onClick(add, () => entries.value = List.adopt<CounterEntry>([...entries.value, new CounterEntry(((nextId = (nextId + 1) | 0) - 1) | 0)], { fixedSize: true }));
      });
      View.forItemsKeyRender<CounterEntry, number>(() => entries.value, (entry: CounterEntry) => entry.id, (entry: CounterEntry) => Counter.create((counter: Counter) => {
        counter.label = Prop.__implicitFromT(`#${entry.id}`);
        counter.onRemove = () => entries.value = List.adopt<CounterEntry>([...linq(entries.value, where((other: CounterEntry) => other.id !== entry.id))], { fixedSize: true });
      }));
    });
  }
}
