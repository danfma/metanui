import { expect } from "bun:test";
import { defaultEquals } from "metano-runtime";
import type { IExpect } from "metanui-reactive-scenarios/metanui/reactive/scenarios";

// The scenarios' IExpect on top of bun:test, shared by every host that runs them.
export const bunExpect: IExpect = {
  equal<T>(expected: T, actual: T, label: string): void {
    const message = `${label}: expected ${Bun.inspect(expected)}, got ${Bun.inspect(actual)}`;

    expect(defaultEquals(expected, actual), message).toBe(true);
  },

  isTrue(condition: boolean, label: string): void {
    expect(condition, label).toBe(true);
  },
};
