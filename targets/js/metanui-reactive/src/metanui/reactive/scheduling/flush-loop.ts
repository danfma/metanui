import type { SignalNode } from "../graph/signal-node.js";
import type { IFlushScheduler } from "../i-flush-scheduler.js";
import { ManualFlushScheduler } from "../manual-flush-scheduler.js";

export class FlushLoop {
  static scheduler = /* @__PURE__ */ new ManualFlushScheduler() as IFlushScheduler;
  private static _head: SignalNode | null = null;
  private static _tail: SignalNode | null = null;
  private static _scheduled: boolean = false;

  constructor() { }

  static enqueue(node: SignalNode): void {
    if (FlushLoop._tail == null) {
      FlushLoop._head = node;
    } else {
      FlushLoop._tail.nextPending = node;
    }

    FlushLoop._tail = node;

    if (!FlushLoop._scheduled) {
      FlushLoop._scheduled = true;
      FlushLoop.scheduler.schedule(FlushLoop.run);
    }
  }

  static run(): void {
    FlushLoop._scheduled = false;
    while (!(FlushLoop._head == null)) {
      const node = FlushLoop._head;
      FlushLoop._head = node.nextPending;
      node.nextPending = null;

      if (FlushLoop._head == null) {
        FlushLoop._tail = null;
      }

      node.commitPending();
    }
  }
}
