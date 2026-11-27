import type { Scenario } from "metanui-reactive-scenarios/metanui/reactive/scenarios";
import { BindingScenarios } from "./binding-scenarios.js";
import { BuildingScenarios } from "./building-scenarios.js";
import { ComponentScenarios } from "./component-scenarios.js";
import { FakePortProbe } from "./fakes/fake-port-probe.js";
import { FakePort } from "./fakes/fake-port.js";
import { ForScenarios } from "./for-scenarios.js";
import { PortContractScenarios } from "./port-contract/port-contract-scenarios.js";
import { RenderScenarios } from "./render-scenarios.js";
import { ShowScenarios } from "./show-scenarios.js";

export class UiScenarios {
  static readonly all: Scenario[] = [...BuildingScenarios.all, ...BindingScenarios.all, ...ComponentScenarios.all, ...ForScenarios.all, ...ShowScenarios.all, ...RenderScenarios.all, ...PortContractScenarios.for("fake", () => new FakePort(), new FakePortProbe())];

  private constructor() { }
}
