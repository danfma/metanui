import type { ClassType } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { Binding } from "./binding.js";

let Bindable$rt: ClassType<Bindable<unknown>> | undefined;

export class Bindable<T> {
  declare readonly value: T;
  declare readonly read: (() => T) | null;

  private constructor(value: T, read: (() => T) | null) {
    this.value = value;
    this.read = read;
  }

  static get $runtimeType(): ClassType<Bindable<unknown>> {
    return (Bindable$rt ??= {
      kind: "class",
      name: "Bindable`1",
      fullName: "Metanui.Spike.Dsl.Variants.Builder.Bindable`1",
      namespace: "Metanui.Spike.Dsl.Variants.Builder",
      ctor: Bindable,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Bindable<unknown> => v instanceof Bindable,
    });
  }

  static __implicitFromT<T>(value: T): Bindable<T> {
    return new Bindable(value, null);
  }

  static __implicitFromBindingOfT<T>(binding: Binding<T>): Bindable<T> {
    return new Bindable(null!, binding.read);
  }

  static __shiftLeft<T>(current: Bindable<T>, read: () => T): Bindable<T> {
    return new Bindable(null!, read);
  }

  $shiftLeft(read: () => T): Bindable<T> {
    return Bindable.__shiftLeft(this, read);
  }

  applyTo(write: (obj: T) => void): void {
    if (this.read == null) {
      write(this.value);

      return;
    }

    Reactivity.effect(this.read, (value: T, previous: T) => write(value));
  }
}
