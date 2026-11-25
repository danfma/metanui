import { SplitEffect } from "./effects/split-effect.js";
import type { IFlushScheduler } from "./i-flush-scheduler.js";
import { RootNode } from "./ownership/root-node.js";
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

  static rootFuncOfActionT<T>(body: (arg: () => void) => T): T {
    return new RootNode().run(body);
  }

  static rootActionOfAction(body: (obj: () => void) => void): void {
    Reactivity.rootFuncOfActionT<boolean>((dispose: () => void) => {
      body(dispose);

      return true;
    });
  }

  static root<T>(body: (arg: () => void) => T): T;
  static root(body: (obj: () => void) => void): void;
  static root(...args: unknown[]): any {
    if (args.length === 1 && typeof args[0] === "function" && args[0].length === 1) {
      return Reactivity.rootFuncOfActionT(args[0] as any);
    }

    if (args.length === 1 && typeof args[0] === "function" && args[0].length === 1) {
      Reactivity.rootActionOfAction(args[0] as (obj: () => void) => void);

      return;
    }

    throw new Error("No matching overload for root");
  }

  static onCleanup(cleanup: () => void): void {
    const owner = Tracking.currentOwner;

    if (!(owner == null)) {
      owner.addCleanup(cleanup);
    } else {
      Tracking.activeApply?.addApplyCleanup(cleanup);
    }
  }

  static untrack<T>(body: () => T): T {
    const previousObserver = Tracking.activeObserver;
    Tracking.activeObserver = null;
    try {
      return body();
    } finally {
      Tracking.activeObserver = previousObserver;
    }
  }
}
