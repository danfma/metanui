import { expect, test } from "bun:test";
import { defaultEquals } from "metano-runtime";
import { type IExpect, ScenarioRunner } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { UiScenarios } from "metanui-ui-scenarios/metanui/ui/scenarios";

const bunExpect: IExpect = {
  equal<T>(expected: T, actual: T, label: string): void {
    const message = `${label}: expected ${Bun.inspect(expected)}, got ${Bun.inspect(actual)}`;

    expect(defaultEquals(expected, actual), message).toBe(true);
  },

  isTrue(condition: boolean, label: string): void {
    expect(condition, label).toBe(true);
  },
};

for (const scenario of UiScenarios.all) {
  test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect));
}
