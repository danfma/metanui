import { test } from "bun:test";
import { ScenarioRunner } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { bunExpect } from "metanui-test-support";
import { UiScenarios } from "metanui-ui-scenarios/metanui/ui/scenarios";

for (const scenario of UiScenarios.all) {
  test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect));
}
