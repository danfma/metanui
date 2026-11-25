import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import type { IFlushScheduler } from "metanui-reactive/metanui/reactive";

export class CountingScheduler implements IFlushScheduler {
  requests: number = 0;
  private readonly _failFirst: boolean;

  constructor(failFirst: boolean = false) {
    this._failFirst = failFirst;
  }

  schedule(flush: () => void): void {
    this.requests = (this.requests + 1) | 0;

    if (this._failFirst && this.requests === 1) {
      throw new InvalidOperationException("Scheduler failed.");
    }
  }
}
