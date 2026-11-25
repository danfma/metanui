import { ComputedScenarios } from "./computed-scenarios.js";
import type { Scenario } from "./scenario.js";
import { SignalScenarios } from "./signal-scenarios.js";

export class ReactiveScenarios {
  static readonly all: Scenario[] = [...SignalScenarios.all, ...ComputedScenarios.all];

  constructor() { }
}
