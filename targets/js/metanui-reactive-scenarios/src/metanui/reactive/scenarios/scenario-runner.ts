import { toException } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import type { IExpect } from "./i-expect.js";
import type { Scenario } from "./scenario.js";

export class ScenarioRunner {
  constructor() { }

  static run(scenario: Scenario, expect: IExpect): void {
    scenario.run(expect);
  }

  static catch(action: () => void): Exception | null {
    try {
      action();

      return null;
    } catch (e$) {
      const e0 = toException(e$);
      const exception = e0;

      return exception;
    }
  }
}
