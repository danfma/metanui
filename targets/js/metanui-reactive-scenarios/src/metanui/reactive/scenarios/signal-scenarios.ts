import { HashCode, copyRecordWith, valueHashCode } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import { Scenario } from "./scenario.js";

class SignalScenarios$CaseInsensitiveComparer {
  constructor() { }

  equals(x: string | null, y: string | null): boolean {
    return (x?.toLowerCase() ?? null) === (y?.toLowerCase() ?? null);
  }

  getHashCode(value: string): number {
    return valueHashCode(value.toLowerCase());
  }
}

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
  static readonly all: Scenario[] = [new Scenario("signal reads its initial value", SignalScenarios.readsInitialValue), new Scenario("write is invisible until flush", SignalScenarios.writeIsInvisibleUntilFlush), new Scenario("last write wins", SignalScenarios.lastWriteWins), new Scenario("flush without writes is a no-op", SignalScenarios.flushWithoutWritesIsNoOp), new Scenario("custom comparer is used", SignalScenarios.customComparerIsUsed)];

  constructor() { }

  private static readsInitialValue(expect: IExpect): void {
    expect.equal(42, Reactivity.signal(42).value, "initial value");
    expect.equal(new SignalScenarios$Point(1, 2), Reactivity.signal(new SignalScenarios$Point(1, 2)).value, "record value");
  }

  private static writeIsInvisibleUntilFlush(expect: IExpect): void {
    const signal = Reactivity.signal(0);
    signal.value = 5;
    expect.equal(0, signal.value, "value before flush");
    expect.equal(0, signal.peek(), "peek before flush");
    Reactivity.flush();
    expect.equal(5, signal.value, "value after flush");
    expect.equal(5, signal.peek(), "peek after flush");
  }

  private static lastWriteWins(expect: IExpect): void {
    const signal = Reactivity.signal(0);
    signal.value = 1;
    signal.value = 2;
    signal.value = 3;
    Reactivity.flush();
    expect.equal(3, signal.value, "last write");
  }

  private static flushWithoutWritesIsNoOp(expect: IExpect): void {
    const signal = Reactivity.signal(7);
    Reactivity.flush();
    Reactivity.flush();
    expect.equal(7, signal.value, "value unchanged by empty flushes");
  }

  private static customComparerIsUsed(expect: IExpect): void {
    const signal = Reactivity.signal("a", new SignalScenarios$CaseInsensitiveComparer());
    signal.value = "A";
    Reactivity.flush();
    expect.equal("a", signal.value, "equal under the comparer keeps the committed value");
  }
}
