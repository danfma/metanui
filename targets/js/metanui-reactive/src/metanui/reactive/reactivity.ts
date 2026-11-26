import type { IDisposable } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { Computed } from "./computed.js";
import { SplitEffect } from "./effects/split-effect.js";
import type { IFlushScheduler } from "./i-flush-scheduler.js";
import { RootNode } from "./ownership/root-node.js";
import { FlushLoop } from "./scheduling/flush-loop.js";
import { Signal } from "./signal.js";
import { Tracking } from "./tracking.js";
import type { IEqualityComparer } from "metano-runtime/system/collections";

export class Reactivity {
  private constructor() { }

  static get scheduler(): IFlushScheduler {
    return FlushLoop.scheduler;
  }

  static useScheduler(scheduler: IFlushScheduler): void {
    FlushLoop.replaceScheduler(scheduler);
  }

  static flush(): void {
    FlushLoop.run();
  }

  static signal<T>(initialValue: T, comparer: IEqualityComparer<T> | null = null): Signal<T> {
    return new Signal(initialValue, comparer);
  }

  static computed<T>(compute: () => T, comparer: IEqualityComparer<T> | null = null): Computed<T> {
    return new Computed(compute, comparer);
  }

  static effect<T>(compute: () => T, apply: (arg1: T, arg2: T) => void): IDisposable {
    const effect = new SplitEffect(compute, apply);
    effect.start();

    return effect;
  }

  static rootBody<T>(body: (arg: () => void) => T): T {
    return new RootNode().run(body);
  }

  static rootVoid(body: (obj: () => void) => void): void {
    Reactivity.rootBody<boolean>((dispose: () => void) => {
      body(dispose);

      return true;
    });
  }

  static root<T>(body: (arg: () => void) => T): T {
    return Reactivity.rootBody<T>(body);
  }

  static errorBoundary(body: () => void, onError: (obj: Exception) => void): void {
    new RootNode(onError).runBoundary(body);
  }

  static onCleanup(cleanup: () => void): void {
    const owner = Tracking.currentOwner;

    if (owner != null) {
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
