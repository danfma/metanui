import type { IFlushScheduler } from "./i-flush-scheduler.js";
import { FlushLoop } from "./scheduling/flush-loop.js";

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
}
