import { HashCode, defaultEquals, type ClassType } from "metano-runtime";

let Prop$rt: ClassType<Prop<unknown>> | undefined;

export class Prop<T> {
  declare private readonly _value: T;
  declare private readonly _read: (() => T) | null;

  constructor(value: T, read: (() => T) | null) {
    this._value = value;
    this._read = read;
  }

  static get $runtimeType(): ClassType<Prop<unknown>> {
    return (Prop$rt ??= {
      kind: "class",
      name: "Prop`1",
      fullName: "Metanui.Ui.Prop`1",
      namespace: "Metanui.Ui",
      ctor: Prop,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: true,
      default: () => Prop.$default(),
      create: () => Prop.$default(),
      test: (v: unknown): v is Prop<unknown> => v instanceof Prop,
    });
  }

  get value(): T {
    return this._read == null ? this._value : this._read();
  }

  static __implicitFromT<T>(value: T): Prop<T> {
    return new Prop(value, null);
  }

  /** @internal */
  static reading<T>(read: () => T): Prop<T> {
    return new Prop(null!, read);
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && defaultEquals(this._value, other._value) && this._read === other._read;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this._value);
    hc.add(this._read);

    return hc.toHashCode();
  }

  static $default<T>(): Prop<T> {
    return Object.assign(Object.create(Prop.prototype), { _value: null, _read: null });
  }
}
