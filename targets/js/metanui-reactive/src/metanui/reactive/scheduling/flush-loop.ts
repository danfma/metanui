import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import type { EffectNode } from "../effects/effect-node.js";
import { DependencyGraph } from "../graph/dependency-graph.js";
import type { SignalNode } from "../graph/signal-node.js";
import type { IFlushScheduler } from "../i-flush-scheduler.js";
import { ManualFlushScheduler } from "../manual-flush-scheduler.js";

export class FlushLoop {
  private static readonly maxPasses: number = 100;
  private static readonly passLimitMessage: string = "Reactive flush exceeded 100 passes; an effect is probably writing a signal it depends on.";
  private static readonly runFlush: () => void = FlushLoop.run;
  static scheduler = /* @__PURE__ */ new ManualFlushScheduler() as IFlushScheduler;
  private static _head: SignalNode | null = null;
  private static _tail: SignalNode | null = null;
  private static _computeHead: EffectNode | null = null;
  private static _computeTail: EffectNode | null = null;
  private static _applyHead: EffectNode | null = null;
  private static _applyTail: EffectNode | null = null;
  private static _scheduled: boolean = false;
  private static _running: boolean = false;

  constructor() { }

  static enqueue(node: SignalNode): void {
    if (FlushLoop._tail == null) {
      FlushLoop._head = node;
    } else {
      FlushLoop._tail.nextPending = node;
    }

    FlushLoop._tail = node;
  }

  static enqueueCompute(effect: EffectNode): void {
    if (FlushLoop._computeTail == null) {
      FlushLoop._computeHead = effect;
    } else {
      FlushLoop._computeTail.nextQueued = effect;
    }

    FlushLoop._computeTail = effect;
  }

  static enqueueApply(effect: EffectNode): void {
    if (effect.hasPendingApply) {
      return;
    }

    effect.hasPendingApply = true;

    if (FlushLoop._applyTail == null) {
      FlushLoop._applyHead = effect;
    } else {
      FlushLoop._applyTail.nextApply = effect;
    }

    FlushLoop._applyTail = effect;
    FlushLoop.requestFlush();
  }

  static requestFlush(): void {
    if (FlushLoop._scheduled || FlushLoop._running) {
      return;
    }

    FlushLoop._scheduled = true;
    try {
      FlushLoop.scheduler.schedule(FlushLoop.runFlush);
    } catch (_err) {
      FlushLoop._scheduled = false;
      throw _err;
    }
  }

  static run(): void {
    if (FlushLoop._running) {
      return;
    }

    FlushLoop._running = true;
    FlushLoop._scheduled = false;
    try {
      FlushLoop.runPasses();
    } finally {
      FlushLoop._running = false;
    }
  }

  private static runPasses(): void {
    let passes = 0;
    while (FlushLoop.hasWork()) {
      if (passes === FlushLoop.maxPasses) {
        FlushLoop.discardPendingWrites();
        throw new InvalidOperationException(FlushLoop.passLimitMessage);
      }

      passes = (passes + 1) | 0;
      FlushLoop.commitAndPropagate();
      FlushLoop.runComputes();
      FlushLoop.runApplies();
    }
  }

  private static hasWork(): boolean {
    return !(FlushLoop._head == null) || !(FlushLoop._computeHead == null) || !(FlushLoop._applyHead == null);
  }

  private static commitAndPropagate(): void {
    let changedHead = null as SignalNode | null;
    let changedTail = null as SignalNode | null;
    try {
      while (!(FlushLoop._head == null)) {
        const node = FlushLoop.dequeuePendingWrite();

        if (!node.update()) {
          continue;
        }

        if (changedTail == null) {
          changedHead = node;
        } else {
          changedTail.nextPending = node;
        }

        changedTail = node;
      }
    } finally {
      FlushLoop.propagateChanges(changedHead);
    }
  }

  private static dequeuePendingWrite(): SignalNode {
    const node = FlushLoop._head!;
    FlushLoop._head = node.nextPending;
    node.nextPending = null;

    if (FlushLoop._head == null) {
      FlushLoop._tail = null;
    }

    return node;
  }

  private static propagateChanges(changed: SignalNode | null): void {
    let node = changed;
    try {
      while (!(node == null)) {
        const subs = node.subs;

        if (!(subs == null)) {
          DependencyGraph.propagate(subs);
          DependencyGraph.shallowPropagate(subs);
        }

        node = FlushLoop.unchain(node);
      }
    } finally {
      while (!(node == null)) {
        node = FlushLoop.unchain(node);
      }
    }
  }

  private static unchain(node: SignalNode): SignalNode | null {
    const next = node.nextPending;
    node.nextPending = null;

    return next;
  }

  private static runComputes(): void {
    while (!(FlushLoop._computeHead == null)) {
      const effect = FlushLoop._computeHead;
      FlushLoop._computeHead = effect.nextQueued;
      effect.nextQueued = null;

      if (FlushLoop._computeHead == null) {
        FlushLoop._computeTail = null;
      }

      effect.runIfDirty();
    }
  }

  private static runApplies(): void {
    while (!(FlushLoop._applyHead == null)) {
      const effect = FlushLoop._applyHead;
      FlushLoop._applyHead = effect.nextApply;
      effect.nextApply = null;
      effect.hasPendingApply = false;

      if (FlushLoop._applyHead == null) {
        FlushLoop._applyTail = null;
      }

      effect.runApply();
    }
  }

  private static discardPendingWrites(): void {
    while (!(FlushLoop._head == null)) {
      FlushLoop.dequeuePendingWrite().discardPending();
    }
  }
}
