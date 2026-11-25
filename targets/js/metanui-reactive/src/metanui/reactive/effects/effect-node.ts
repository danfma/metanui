import { throwError, toException } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { DependencyGraph } from "../graph/dependency-graph.js";
import { ReactiveFlags } from "../graph/reactive-flags.js";
import { CleanupEntry } from "../ownership/cleanup-entry.js";
import { OwnerNode } from "../ownership/owner-node.js";
import { RootNode } from "../ownership/root-node.js";
import { Teardown } from "../ownership/teardown.js";
import { FlushLoop } from "../scheduling/flush-loop.js";
import { Tracking } from "../tracking.js";

export abstract class EffectNode extends OwnerNode {
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
    if (this.tryRunCompute()) {
      FlushLoop.enqueueApply(this);
    }
  }

  /** @internal */
  runIfDirty(): void {
    if (this.isDisposed) {
      return;
    }

    const flags = this.flags;

    if ((flags & ReactiveFlags.Dirty) !== 0 || (flags & ReactiveFlags.Pending) !== 0 && DependencyGraph.checkDirty(this.deps!, this)) {
      if (this.tryRunCompute()) {
        FlushLoop.enqueueApply(this);
      }
    } else {
      if (!(this.deps == null)) {
        this.flags = ReactiveFlags.Watching;
      }
    }
  }

  /** @internal */
  runApply(): void {
    if (this.isDisposed) {
      return;
    }

    try {
      this.runApplyUnowned();
    } catch (e$) {
      const e0 = toException(e$);
      const error = e0;

      if (!RootNode.tryRouteError(this, error)) {
        throw e$;
      }
    }
  }

  private runApplyUnowned(): void {
    const previousObserver = Tracking.activeObserver;
    const previousOwner = Tracking.currentOwner;
    const previousApply = Tracking.activeApply;
    Tracking.activeObserver = null;
    Tracking.currentOwner = null;
    try {
      this.runApplyCleanups();

      if (this.isDisposed) {
        return;
      }

      Tracking.activeApply = this;
      this.apply();
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
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
  onDisposed(): void {
    const applyCleanups = this._applyCleanups;
    this._applyCleanups = null;
    Teardown.run(applyCleanups);
    this.depsTail = null;
    this.flags = ReactiveFlags.None;
    DependencyGraph.purgeDeps(this);
    this.releaseUserState();
  }

  /** @internal */
  update(): boolean {
    return throwError(new InvalidOperationException("An effect cannot be updated."));
  }

  protected abstract compute(): void;

  protected abstract apply(): void;

  protected abstract releaseUserState(): void;

  private tryRunCompute(): boolean {
    try {
      this.runCompute();

      return !this.isDisposed;
    } catch (e$) {
      const e0 = toException(e$);
      const error = e0;

      if (!RootNode.tryRouteError(this, error)) {
        throw e$;
      }

      return false;
    }
  }

  private runCompute(): void {
    this.disposeOwned();

    if (this.isDisposed) {
      return;
    }

    this.depsTail = null;
    this.flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
    const previousObserver = Tracking.activeObserver;
    const previousOwner = Tracking.currentOwner;
    Tracking.activeObserver = this;
    Tracking.currentOwner = this;
    try {
      Tracking.cycle = (Tracking.cycle + 1) | 0;
      this.compute();
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
      this.flags &= ~ReactiveFlags.RecursedCheck;
      this.purgeStaleDeps();
    }
  }

  private runApplyCleanups(): void {
    const entry = this._applyCleanups;
    this._applyCleanups = null;
    const error = Teardown.runChain(entry);

    if (!(error == null)) {
      throw error;
    }
  }
}
