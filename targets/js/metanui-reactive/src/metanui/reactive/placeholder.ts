import { HashCode, copyRecordWith, type ClassType } from "metano-runtime";

let Placeholder$rt: ClassType<Placeholder> | undefined;

export class Placeholder {
  constructor(readonly name: string) { }

  static get $runtimeType(): ClassType<Placeholder> {
    return (Placeholder$rt ??= {
      kind: "class",
      name: "Placeholder",
      fullName: "Metanui.Reactive.Placeholder",
      namespace: "Metanui.Reactive",
      ctor: Placeholder,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Placeholder => v instanceof Placeholder,
    });
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && this.name === other.name;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.name);

    return hc.toHashCode();
  }

  with(overrides?: Partial<Placeholder>): Placeholder {
    return copyRecordWith<Placeholder>(this, overrides);
  }

  toString(): string {
    return `Placeholder { Name = ${this.name} }`;
  }
}
