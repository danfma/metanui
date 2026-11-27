import { List, type IReadOnlyList } from "metano-runtime/system/collections";
import type { ClassType } from "metano-runtime";
import { linq, where } from "metano-runtime/system/linq";
import { Reactivity, type Signal } from "metanui-reactive/metanui/reactive";
import { button, h2, onClick, p, section } from "metanui-ui-web/metanui/ui/web";
import { Component, Prop, View } from "metanui-ui/metanui/ui";
import { CounterEntry } from "./counter-entry.js";
import { Counter } from "./counter.js";

let CounterList$rt: ClassType<CounterList> | undefined;

export class CounterList extends Component<CounterList> {
  declare private readonly _entries: Signal<IReadOnlyList<CounterEntry>>;
  declare private _nextId: number;

  constructor() {
    super();
    this._entries = Reactivity.signal<IReadOnlyList<CounterEntry>>(List.adopt<CounterEntry>([], { fixedSize: true }));
    this._nextId = 1;
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

  static createBuild(build: (obj: CounterList) => void): void {
    View.mount(new CounterList(), build);
  }

  static createDefault(): void {
    CounterList.createBuild((_: CounterList) => {
    });
  }

  static create(build: (obj: CounterList) => void): void;
  static create(): void;
  static create(...args: unknown[]): void {
    if (args.length === 1 && typeof args[0] === "function") {
      CounterList.createBuild(args[0] as (obj: CounterList) => void);

      return;
    }

    if (args.length === 0) {
      CounterList.createDefault();

      return;
    }

    throw new Error("No matching overload for create");
  }

  override render(): void {
    section((section) => {
      section.className = "counter-list";
      h2((heading) => heading.textContent = "Counters");
      p((summary) => View.bindWrite(() => summary.textContent = `In list: ${this._entries.value.count}`));
      button((add) => {
        add.textContent = "Add counter";
        onClick(add, this.addCounter.bind(this));
      });
      View.forItemsKeyRender<CounterEntry, number>(() => this._entries.value, (entry: CounterEntry) => entry.id, (entry: CounterEntry) => Counter.create((counter: Counter) => {
        counter.label = Prop.__implicitFromT(`#${entry.id}`);
        counter.onRemove = () => this.removeCounter(entry.id);
      }));
    });
  }

  private addCounter(): void {
    const entry = new CounterEntry(this._nextId);
    this._nextId = (this._nextId + 1) | 0;
    this._entries.update((list: IReadOnlyList<CounterEntry>) => List.adopt<CounterEntry>([...list, entry], { fixedSize: true }));
  }

  private removeCounter(id: number): void {
    this._entries.update((list: IReadOnlyList<CounterEntry>) => List.adopt<CounterEntry>([...linq(list, where((entry: CounterEntry) => entry.id !== id))], { fixedSize: true }));
  }
}
