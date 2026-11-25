import type { Scenario } from "./scenario.js";
import { SignalScenarios } from "./signal-scenarios.js";

export class ReactiveScenarios {
  static readonly all: Scenario[] = [...SignalScenarios.all];

  constructor() { }
}
