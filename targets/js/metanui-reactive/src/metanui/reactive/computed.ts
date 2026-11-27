import { defaultEqualityComparerFor, throwError, toException, type ClassType } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { ComputedNode } from "./computed-node.js";
import { DependencyGraph } from "./graph/dependency-graph.js";
import { ReactiveFlags } from "./graph/reactive-flags.js";
import type { ReactiveNode } from "./graph/reactive-node.js";
import { FlushLoop } from "./scheduling/flush-loop.js";
import { Tracking } from "./tracking.js";
import type { IEqualityComparer } from "metano-runtime/system/collections";

let Computed$rt: ClassType<Computed<unknown>> | undefined;

export class Computed<T> extends ComputedNode {
  declare private _compute: (() => T) | null;
  declare private _comparer: IEqualityComparer<T> | null;
  declare private _value: T;
  declare private _error: Exception | null;
  declare private _failedInPass: number;

  constructor(compute: () => T, comparer: IEqualityComparer<T> | null = null) {
    super();
    this._compute = null;
    this._comparer = null;
    this._value = null!;
    this._error = null;
    this._failedInPass = 0;
    this._compute = compute;
    this._comparer = comparer ?? defaultEqualityComparerFor();
  }

  static override get $runtimeType(): ClassType<Computed<unknown>> {
    return (Computed$rt ??= {
      kind: "class",
      name: "Computed`1",
      fullName: "Metanui.Reactive.Computed`1",
      namespace: "Metanui.Reactive",
      ctor: Computed,
      base: () => ComputedNode.$runtimeType,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Computed<unknown> => v instanceof Computed,
    });
  }

  get value(): T {
    this.refreshIfStale();
    const observer = Tracking.activeObserver;

    if ((this.flags & ReactiveFlags.Errored) !== 0) {
      return this.readErrored(observer);
    }

    if (observer != null) {
      DependencyGraph.link(this, observer, Tracking.cycle);
    }

    return this._value;
  }

  peek(): T {
    this.refreshIfStale();

    if ((this.flags & ReactiveFlags.Errored) !== 0) {
      throw this._error!;
    }

    return this._value;
  }

  /** @internal */
  override refresh(): boolean {
    if (this.isDisposed) {
      this.settleDisposedFlags();

      return false;
    }

    const compute = this._compute!;
    const comparer = this._comparer!;
    this.disposeOwned();
    const wasErrored = (this.flags & ReactiveFlags.Errored) !== 0;
    this._error = null;
    this.depsTail = null;
    this.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const previousObserver = Tracking.activeObserver;
    const previousOwner = Tracking.currentOwner;
    Tracking.activeObserver = this;
    Tracking.currentOwner = this;
    try {
      Tracking.cycle = (Tracking.cycle + 1) | 0;
      const next = compute();

      if (!wasErrored && comparer.equals(this._value, next)) {
        return false;
      }

      this._value = next;

      return true;
    } catch (e$) {
      const error = toException(e$);
      this.cacheError(error);

      return true;
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
      this.flags &= ~ReactiveFlags.RecursedCheck;
      this.purgeStaleDeps();
    }
  }

  /** @internal */
  override retryAtPassStart(): boolean {
    if (this.isDisposed || (this.flags & ReactiveFlags.Errored) === 0 || this.subs == null) {
      return false;
    }

    this.refresh();

    return (this.flags & ReactiveFlags.Errored) === 0;
  }

  /** @internal */
  override notify(): void {
    throwError(new InvalidOperationException("A computed cannot be notified."));
  }

  /** @internal */
  override unwatched(): void {
    if (this.isDisposed || (this.flags & ReactiveFlags.RecursedCheck) !== 0) {
      return;
    }

    if (this.depsTail != null) {
      this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
      DependencyGraph.disposeAllDepsInReverse(this);
      this.disposeOwned();
    } else if (this.firstChild != null || this.cleanups != null) {
      if ((this.flags & ReactiveFlags.Errored) === 0) {
        this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
      }

      this.disposeOwned();
    }
  }

  /** @internal */
  override onDisposed(): void {
    this.depsTail = null;
    this.flags &= ReactiveFlags.Errored;
    this.unlinkDependenciesOnDisposal();
    this._compute = null;
    this._comparer = null;
  }

  private refreshIfStale(): void {
    const flags = this.flags;

    if ((flags & ReactiveFlags.Dirty) !== 0) {
      this.recompute();
    } else if ((flags & ReactiveFlags.Pending) !== 0) {
      this.recomputeIfDependencyChanged();
    } else if (flags === ReactiveFlags.None) {
      this.runFirst();
    }
  }

  private recomputeIfDependencyChanged(): void {
    if (this.isDisposed) {
      this.settleDisposedFlags();

      return;
    }

    if (this.isAnyDependencyDirty()) {
      this.recompute();

      return;
    }

    this.flags &= ~ReactiveFlags.Pending;

    if ((this.flags & ReactiveFlags.Dirty) !== 0) {
      this.recompute();
    }
  }

  private recompute(): void {
    if (!this.refresh()) {
      return;
    }

    const subs = this.subs;

    if (subs != null) {
      DependencyGraph.shallowPropagate(subs);
    }
  }

  private runFirst(): void {
    if (this.isDisposed) {
      return;
    }

    this.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const previousObserver = Tracking.activeObserver;
    const previousOwner = Tracking.currentOwner;
    Tracking.activeObserver = this;
    Tracking.currentOwner = this;
    try {
      this._value = this._compute!();
    } catch (e$) {
      const error = toException(e$);
      this.cacheError(error);
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
      this.flags &= ~ReactiveFlags.RecursedCheck;
      this.purgeStaleDeps();
    }
  }

  private settleDisposedFlags(): void {
    this.flags &= ReactiveFlags.Errored;
  }

  private cacheError(error: Exception): void {
    this._error = error;
    this._failedInPass = Tracking.pass;
    this.flags |= ReactiveFlags.Errored;
  }

  private readErrored(observer: ReactiveNode | null): T {
    if (observer == null) {
      throw this._error!;
    }

    const retry = this.shouldRetryOnReread(observer);
    DependencyGraph.link(this, observer, Tracking.cycle);

    if (retry) {
      FlushLoop.enqueueRetry(this);
    }

    throw this._error!;
  }

  private shouldRetryOnReread(observer: ReactiveNode): boolean {
    return this.isNextDependencyOf(observer) && this._failedInPass !== Tracking.pass && !this.isDisposed;
  }

  private isNextDependencyOf(observer: ReactiveNode): boolean {
    const tail = observer.depsTail;
    const next = tail != null ? tail.nextDep : observer.deps;

    return next != null && next.dep === this;
  }
}
