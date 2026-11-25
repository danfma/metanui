import { expect, test } from "bun:test";
import {
  type IExpect,
  ReactiveScenarios,
  ScenarioRunner,
} from "metanui-reactive-scenarios/metanui/reactive/scenarios";

const bunExpect: IExpect = {
  equal<T>(expected: T, actual: T, label: string): void {
    expect(actual, label).toEqual(expected);
  },

  isTrue(condition: boolean, label: string): void {
    expect(condition, label).toBe(true);
  },
};

for (const scenario of ReactiveScenarios.all) {
  test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect));
}
