import { defaultEqualityComparerFor, throwError, toException, type ClassType } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { DependencyGraph } from "./graph/dependency-graph.js";
import { ReactiveFlags } from "./graph/reactive-flags.js";
import type { ReactiveNode } from "./graph/reactive-node.js";
import { OwnerNode } from "./ownership/owner-node.js";
import { FlushLoop } from "./scheduling/flush-loop.js";
import { Tracking } from "./tracking.js";
import type { IEqualityComparer } from "metano-runtime/system/collections";

let Computed$rt: ClassType<Computed<unknown>> | undefined;

export class Computed<T> extends OwnerNode {
  private _compute: (() => T) | null = null;
  private _comparer: IEqualityComparer<T> | null = null;
  private _value: T = null!;
  private _error: Exception | null = null;
  private _errorPass: number = 0;

  constructor(compute: () => T, comparer: IEqualityComparer<T> | null = null) {
    super();
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
      base: () => OwnerNode.$runtimeType,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Computed<unknown> => v instanceof Computed,
    });
  }

  get value(): T {
    this.refresh();
    const observer = Tracking.activeObserver;

    if ((this.flags & ReactiveFlags.Errored) !== 0) {
      return this.readErrored(observer);
    }

    if (!(observer == null)) {
      DependencyGraph.link(this, observer, Tracking.cycle);
    }

    return this._value;
  }

  peek(): T {
    this.refresh();

    if ((this.flags & ReactiveFlags.Errored) !== 0) {
      throw this._error!;
    }

    return this._value;
  }

  /** @internal */
  override update(): boolean {
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
      const e0 = toException(e$);
      const error = e0;
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
  override notify(): void {
    throwError(new InvalidOperationException("A computed cannot be notified."));
  }

  /** @internal */
  override unwatched(): void {
    if (this.depsTail == null) {
      return;
    }

    this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    DependencyGraph.disposeAllDepsInReverse(this);
    this.disposeOwned();
  }

  /** @internal */
  override onDisposed(): void {
    this.depsTail = null;
    this.flags = ReactiveFlags.Mutable | this.flags & ReactiveFlags.Errored;
    DependencyGraph.purgeDeps(this);
    this._compute = null;
    this._comparer = null;
  }

  private refresh(): void {
    const flags = this.flags;

    if ((flags & ReactiveFlags.Dirty) !== 0) {
      this.recompute();
    } else {
      if ((flags & ReactiveFlags.Pending) !== 0) {
        this.recomputeIfDependencyChanged(flags);
      } else {
        if (flags === ReactiveFlags.None) {
          this.runFirst();
        }
      }
    }
  }

  private recomputeIfDependencyChanged(flags: ReactiveFlags): void {
    if (DependencyGraph.checkDirty(this.deps!, this) || (this.flags & ReactiveFlags.Dirty) !== 0) {
      this.recompute();
    } else {
      this.flags = flags & ~ReactiveFlags.Pending;
    }
  }

  private recompute(): void {
    if (!this.update()) {
      return;
    }

    const subs = this.subs;

    if (!(subs == null)) {
      DependencyGraph.shallowPropagate(subs);
    }
  }

  private runFirst(): void {
    this.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const previousObserver = Tracking.activeObserver;
    const previousOwner = Tracking.currentOwner;
    Tracking.activeObserver = this;
    Tracking.currentOwner = this;
    try {
      this._value = this._compute!();
    } catch (e$) {
      const e0 = toException(e$);
      const error = e0;
      this.cacheError(error);
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
      this.flags &= ~ReactiveFlags.RecursedCheck;
      this.purgeStaleDeps();
    }
  }

  private cacheError(error: Exception): void {
    this._error = error;
    this._errorPass = Tracking.pass;
    this.flags |= ReactiveFlags.Errored;
  }

  private readErrored(observer: ReactiveNode | null): T {
    if (observer == null) {
      throw this._error!;
    }

    if (this.isNextDependencyOf(observer) && this._errorPass !== Tracking.pass && !this.isDisposed) {
      const cycle = Tracking.cycle;
      this.retry();
      DependencyGraph.link(this, observer, cycle);

      if ((this.flags & ReactiveFlags.Errored) === 0) {
        return this._value;
      }

      throw this._error!;
    }

    DependencyGraph.link(this, observer, Tracking.cycle);
    throw this._error!;
  }

  private retry(): void {
    this.update();
    const subs = this.subs;

    if (!(subs == null)) {
      DependencyGraph.propagate(subs);
      DependencyGraph.shallowPropagate(subs);
      FlushLoop.requestFlush();
    }
  }

  private isNextDependencyOf(observer: ReactiveNode): boolean {
    const tail = observer.depsTail;
    const next = !(tail == null) ? tail.nextDep : observer.deps;

    return !(next == null) && next.dep === this;
  }
}
