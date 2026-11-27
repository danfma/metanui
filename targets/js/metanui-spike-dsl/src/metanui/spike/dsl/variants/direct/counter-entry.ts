import type { ClassType } from "metano-runtime";

let CounterEntry$rt: ClassType<CounterEntry> | undefined;

export class CounterEntry {
  declare readonly id: number;

  constructor(id: number) {
    this.id = id;
  }

  static get $runtimeType(): ClassType<CounterEntry> {
    return (CounterEntry$rt ??= {
      kind: "class",
      name: "CounterEntry",
      fullName: "Metanui.Spike.Dsl.Variants.Direct.CounterEntry",
      namespace: "Metanui.Spike.Dsl.Variants.Direct",
      ctor: CounterEntry,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is CounterEntry => v instanceof CounterEntry,
    });
  }
}
