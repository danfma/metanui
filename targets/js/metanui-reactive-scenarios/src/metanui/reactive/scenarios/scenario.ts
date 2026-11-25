import { HashCode, copyRecordWith, type ClassType } from "metano-runtime";
import type { IExpect } from "./i-expect.js";

let Scenario$rt: ClassType<Scenario> | undefined;

export class Scenario {
  constructor(readonly name: string, readonly run: (obj: IExpect) => void) { }

  static get $runtimeType(): ClassType<Scenario> {
    return (Scenario$rt ??= {
      kind: "class",
      name: "Scenario",
      fullName: "Metanui.Reactive.Scenarios.Scenario",
      namespace: "Metanui.Reactive.Scenarios",
      ctor: Scenario,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Scenario => v instanceof Scenario,
    });
  }

  toString(): string {
    return this.name;
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && this.name === other.name && this.run === other.run;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.name);
    hc.add(this.run);

    return hc.toHashCode();
  }

  with(overrides?: Partial<Scenario>): Scenario {
    return copyRecordWith<Scenario>(this, overrides);
  }
}
