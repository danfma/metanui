import { toException } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { ManualFlushScheduler, Reactivity } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import type { Scenario } from "./scenario.js";

export class ScenarioRunner {
  constructor() { }

  static run(scenario: Scenario, expect: IExpect): void {
    let dispose = () => {
    };
    Reactivity.scheduler = new ManualFlushScheduler();
    try {
      Reactivity.rootActionOfAction((disposeRoot: () => void) => {
        dispose = disposeRoot;
        scenario.run(expect);
      });
      Reactivity.flush();
    } finally {
      dispose();
    }
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
