import { IDisposable$runtimeType, disposeResource, throwError, toException, type ClassType, type IDisposable } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { ReactiveFlags } from "../graph/reactive-flags.js";
import { CleanupEntry } from "../ownership/cleanup-entry.js";
import { OwnerNode } from "../ownership/owner-node.js";
import { RootNode } from "../ownership/root-node.js";
import { Teardown } from "../ownership/teardown.js";
import { FlushLoop } from "../scheduling/flush-loop.js";
import { Tracking } from "../tracking.js";

let EffectNode$rt: ClassType<EffectNode> | undefined;

export abstract class EffectNode extends OwnerNode implements IDisposable {
  /** @internal */
  declare nextQueued: EffectNode | null;

  /** @internal */
  declare nextApply: EffectNode | null;

  /** @internal */
  declare hasPendingApply: boolean;

  declare private _applyCleanups: CleanupEntry | null;

  constructor() {
    super();
    this.nextQueued = null;
    this.nextApply = null;
    this.hasPendingApply = false;
    this._applyCleanups = null;
  }

  static override get $runtimeType(): ClassType<EffectNode> {
    return (EffectNode$rt ??= {
      kind: "class",
      name: "EffectNode",
      fullName: "Metanui.Reactive.Effects.EffectNode",
      namespace: "Metanui.Reactive.Effects",
      ctor: EffectNode,
      base: () => OwnerNode.$runtimeType,
      interfaces: [
        () => IDisposable$runtimeType,
      ],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is EffectNode => v instanceof EffectNode,
    });
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

    if ((flags & ReactiveFlags.Dirty) !== 0 || (flags & ReactiveFlags.Pending) !== 0 && this.isAnyDependencyDirty()) {
      if (this.tryRunCompute()) {
        FlushLoop.enqueueApply(this);
      }
    } else if (!this.isDisposed && this.deps != null) {
      this.flags = ReactiveFlags.Watching;
    }
  }

  /** @internal */
  runApply(): void {
    if (this.isDisposed) {
      return;
    }

    const owner = this.parent;
    try {
      this.runApplyUnowned();
    } catch (e$) {
      const error = toException(e$);

      if (!RootNode.tryRouteError(owner, error)) {
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
      try {
        this.apply();
      } catch (_err) {
        this.endApply(previousApply);
        throw _err;
      }
      const lateCleanupError = this.endApply(previousApply);

      if (lateCleanupError != null) {
        throw lateCleanupError;
      }
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
      Tracking.activeApply = previousApply;
    }
  }

  private endApply(previousApply: EffectNode | null): Exception | null {
    Tracking.activeApply = previousApply;

    if (!this.isDisposed) {
      return null;
    }

    const lateCleanups = this._applyCleanups;
    this._applyCleanups = null;

    return Teardown.runChain(lateCleanups);
  }

  /** @internal */
  addApplyCleanup(cleanup: () => void): void {
    this._applyCleanups = new CleanupEntry(cleanup, this._applyCleanups);
  }

  /** @internal */
  override notify(): void {
    this.flags &= ~ReactiveFlags.Watching;
    FlushLoop.enqueueCompute(this);
  }

  /** @internal */
  override onDisposed(): void {
    const applyCleanups = this._applyCleanups;
    this._applyCleanups = null;
    Teardown.run(applyCleanups);
    this.depsTail = null;
    this.flags = ReactiveFlags.None;
    this.unlinkDependenciesOnDisposal();
    this.releaseUserState();
  }

  /** @internal */
  override update(): boolean {
    return throwError(new InvalidOperationException("An effect cannot be updated."));
  }

  protected abstract compute(): void;

  protected abstract apply(): void;

  protected abstract releaseUserState(): void;

  private tryRunCompute(): boolean {
    const owner = this.parent;
    try {
      this.runCompute();

      return !this.isDisposed;
    } catch (e$) {
      const error = toException(e$);

      if (!RootNode.tryRouteError(owner, error)) {
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

    if (error != null) {
      throw error;
    }
  }

  [Symbol.dispose](): void {
    disposeResource(this, this.dispose);
  }
}
