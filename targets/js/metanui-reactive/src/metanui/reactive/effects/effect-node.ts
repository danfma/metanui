import { throwError } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { DependencyGraph } from "../graph/dependency-graph.js";
import { ReactiveFlags } from "../graph/reactive-flags.js";
import { ReactiveNode } from "../graph/reactive-node.js";
import { FlushLoop } from "../scheduling/flush-loop.js";
import { Tracking } from "../tracking.js";
import { CleanupEntry } from "./cleanup-entry.js";

export abstract class EffectNode extends ReactiveNode {
  /** @internal */
  nextQueued: EffectNode | null = null;

  /** @internal */
  nextApply: EffectNode | null = null;

  /** @internal */
  hasPendingApply: boolean = false;

  private _applyCleanups: CleanupEntry | null = null;

  constructor() {
    super();
  }

  /** @internal */
  start(): void {
    this.runCompute();
    FlushLoop.enqueueApply(this);
  }

  /** @internal */
  runIfDirty(): void {
    const flags = this.flags;

    if ((flags & ReactiveFlags.Dirty) !== 0 || (flags & ReactiveFlags.Pending) !== 0 && DependencyGraph.checkDirty(this.deps!, this)) {
      this.runCompute();
      FlushLoop.enqueueApply(this);
    } else {
      if (!(this.deps == null)) {
        this.flags = ReactiveFlags.Watching;
      }
    }
  }

  /** @internal */
  runApply(): void {
    const previousObserver = Tracking.activeObserver;
    const previousApply = Tracking.activeApply;
    Tracking.activeObserver = null;
    try {
      this.runApplyCleanups();
      Tracking.activeApply = this;
      this.apply();
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.activeApply = previousApply;
    }
  }

  /** @internal */
  addApplyCleanup(cleanup: () => void): void {
    this._applyCleanups = new CleanupEntry(cleanup, this._applyCleanups);
  }

  /** @internal */
  notify(): void {
    this.flags &= ~ReactiveFlags.Watching;
    FlushLoop.enqueueCompute(this);
  }

  /** @internal */
  update(): boolean {
    return throwError(new InvalidOperationException("An effect cannot be updated."));
  }

  protected abstract compute(): void;

  protected abstract apply(): void;

  private runCompute(): void {
    this.depsTail = null;
    this.flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
    const previousObserver = Tracking.activeObserver;
    Tracking.activeObserver = this;
    try {
      Tracking.cycle = (Tracking.cycle + 1) | 0;
      this.compute();
    } finally {
      Tracking.activeObserver = previousObserver;
      this.flags &= ~ReactiveFlags.RecursedCheck;
      DependencyGraph.purgeDeps(this);
    }
  }

  private runApplyCleanups(): void {
    let entry = this._applyCleanups;
    this._applyCleanups = null;
    while (!(entry == null)) {
      entry.cleanup();
      entry = entry.next;
    }
  }
}
