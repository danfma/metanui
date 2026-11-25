import { toException } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { ManualFlushScheduler, Reactivity } from "metanui-reactive/metanui/reactive";
import type { IExpect } from "./i-expect.js";
import type { Scenario } from "./scenario.js";

export class ScenarioRunner {
  constructor() { }

  static run(scenario: Scenario, expect: IExpect): void {
    const outerScheduler = Reactivity.scheduler;
    Reactivity.useScheduler(new ManualFlushScheduler());
    try {
      ScenarioRunner.runInRoot(scenario, expect);
    } finally {
      Reactivity.useScheduler(outerScheduler);
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

  private static runInRoot(scenario: Scenario, expect: IExpect): void {
    let dispose = () => {
    };
    try {
      Reactivity.rootActionOfAction((disposeRoot: () => void) => {
        dispose = disposeRoot;
        scenario.run(expect);
      });
      Reactivity.flush();
    } catch (_err) {
      ScenarioRunner.catch(() => ScenarioRunner.settle(dispose));
      throw _err;
    }
    ScenarioRunner.settle(dispose);
  }

  private static settle(dispose: () => void): void {
    try {
      dispose();
    } finally {
      Reactivity.flush();
    }
  }
}
