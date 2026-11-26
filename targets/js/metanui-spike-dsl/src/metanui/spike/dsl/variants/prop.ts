import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";

let Prop$rt: ClassType<Prop<unknown>> | undefined;

export class Prop<T> {
  declare readonly value: T;
  declare readonly read: (() => T) | null;

  private constructor(value: T, read: (() => T) | null) {
    this.value = value;
    this.read = read;
  }

  static get $runtimeType(): ClassType<Prop<unknown>> {
    return (Prop$rt ??= {
      kind: "class",
      name: "Prop`1",
      fullName: "Metanui.Spike.Dsl.Variants.Prop`1",
      namespace: "Metanui.Spike.Dsl.Variants",
      ctor: Prop,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Prop<unknown> => v instanceof Prop,
    });
  }

  static __implicitFromT<T>(value: T): Prop<T> {
    return new Prop(value, null);
  }

  static bound<T>(read: () => T): Prop<T> {
    return new Prop(null!, read);
  }

  applyTo(write: (obj: T) => void): void {
    if (this.read == null) {
      write(this.value);

      return;
    }

    Reactivity.effect(this.read, (current: T, previous: T) => write(current));
  }
}
