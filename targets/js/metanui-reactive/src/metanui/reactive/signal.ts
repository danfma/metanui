import type { ClassType } from "metano-runtime";

let Signal$rt: ClassType<Signal<unknown>> | undefined;

export class Signal<T> {
  private readonly _value: T;

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  static get $runtimeType(): ClassType<Signal<unknown>> {
    return (Signal$rt ??= {
      kind: "class",
      name: "Signal`1",
      fullName: "Metanui.Reactive.Signal`1",
      namespace: "Metanui.Reactive",
      ctor: Signal,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Signal<unknown> => v instanceof Signal,
    });
  }

  get value(): T {
    return this._value;
  }
}
