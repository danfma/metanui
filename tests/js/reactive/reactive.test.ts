import { test } from "bun:test";
import {
  ReactiveScenarios,
  ScenarioRunner,
} from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { bunExpect } from "metanui-test-support";

for (const scenario of ReactiveScenarios.all) {
  test(scenario.name, () => ScenarioRunner.run(scenario, bunExpect));
}
