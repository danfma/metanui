import { expect, test } from "bun:test";
import { defaultEquals } from "metano-runtime";
import {
  type IExpect,
  ReactiveScenarios,
  ScenarioRunner,
} from "metanui-reactive-scenarios/metanui/reactive/scenarios";

const bunExpect: IExpect = {
  equal<T>(expected: T, actual: T, label: string): void {
    const message = `${label}: expected ${Bun.inspect(expected)}, got ${Bun.inspect(actual)}`;

    expect(defaultEquals(expected, actual), message).toBe(true);
  },

  isTrue(condition: boolean, label: string): void {
    expect(condition, label).toBe(true);
  },
};

for (const scenario of ReactiveScenarios.all) {
  test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect));
}
