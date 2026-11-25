import { SplitEffect } from "./effects/split-effect.js";
import type { IFlushScheduler } from "./i-flush-scheduler.js";
import { FlushLoop } from "./scheduling/flush-loop.js";
import { Tracking } from "./tracking.js";

export class Reactivity {
  constructor() { }

  static get scheduler(): IFlushScheduler {
    return FlushLoop.scheduler;
  }

  static set scheduler(value: IFlushScheduler) {
    FlushLoop.scheduler = value;
  }

  static flush(): void {
    FlushLoop.run();
  }

  static effect<T>(compute: () => T, apply: (arg1: T, arg2: T | null) => void): void {
    new SplitEffect(compute, apply).start();
  }

  static onCleanup(cleanup: () => void): void {
    const apply = Tracking.activeApply;

    if (!(apply == null)) {
      apply.addApplyCleanup(cleanup);
    }
  }
}
