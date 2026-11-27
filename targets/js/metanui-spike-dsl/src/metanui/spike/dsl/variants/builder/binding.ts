import type { ClassType } from "metano-runtime";

let Binding$rt: ClassType<Binding<unknown>> | undefined;

export class Binding<T> {
  declare readonly read: () => T;

  constructor(read: () => T) {
    this.read = read;
  }

  static get $runtimeType(): ClassType<Binding<unknown>> {
    return (Binding$rt ??= {
      kind: "class",
      name: "Binding`1",
      fullName: "Metanui.Spike.Dsl.Variants.Builder.Binding`1",
      namespace: "Metanui.Spike.Dsl.Variants.Builder",
      ctor: Binding,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Binding<unknown> => v instanceof Binding,
    });
  }
}
