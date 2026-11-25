import { HashCode, copyRecordWith } from "metano-runtime";
import { Signal } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { Scenario } from "./scenario.js";

class SignalScenarios$Point {
  constructor(readonly x: number, readonly y: number) { }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && this.x === other.x && this.y === other.y;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.x);
    hc.add(this.y);

    return hc.toHashCode();
  }

  with(overrides?: Partial<SignalScenarios$Point>): SignalScenarios$Point {
    return copyRecordWith<SignalScenarios$Point>(this, overrides);
  }

  toString(): string {
    return `Point { X = ${this.x}, Y = ${this.y} }`;
  }
}

export class SignalScenarios {
  static readonly all: Scenario[] = [new Scenario("signal reads its initial value", SignalScenarios.readsInitialValue)];

  constructor() { }

  private static readsInitialValue(expect: IExpect): void {
    expect.equal(42, new Signal(42).value, "initial value");
    expect.equal(new SignalScenarios$Point(1, 2), new Signal(new SignalScenarios$Point(1, 2)).value, "record value");
  }
}
