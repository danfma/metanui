import { ComputedScenarios } from "./computed-scenarios.js";
import { EffectScenarios } from "./effect-scenarios.js";
import { ErrorScenarios } from "./error-scenarios.js";
import { FlushScenarios } from "./flush-scenarios.js";
import { OwnershipScenarios } from "./ownership-scenarios.js";
import type { Scenario } from "./scenario.js";
import { SignalScenarios } from "./signal-scenarios.js";

export class ReactiveScenarios {
  static readonly all: Scenario[] = [...SignalScenarios.all, ...ComputedScenarios.all, ...EffectScenarios.all, ...FlushScenarios.all, ...OwnershipScenarios.all, ...ErrorScenarios.all];

  constructor() { }
}
