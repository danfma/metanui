import { ComputedScenarios } from "./computed-scenarios.js";
import { EffectScenarios } from "./effect-scenarios.js";
import { FlushScenarios } from "./flush-scenarios.js";
import type { Scenario } from "./scenario.js";
import { SignalScenarios } from "./signal-scenarios.js";

export class ReactiveScenarios {
  static readonly all: Scenario[] = [...SignalScenarios.all, ...ComputedScenarios.all, ...EffectScenarios.all, ...FlushScenarios.all];

  constructor() { }
}
