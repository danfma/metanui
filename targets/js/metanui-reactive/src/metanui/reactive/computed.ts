import { defaultEqualityComparerFor, throwError, type ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { DependencyGraph } from "./graph/dependency-graph.js";
import { ReactiveFlags } from "./graph/reactive-flags.js";
import { OwnerNode } from "./ownership/owner-node.js";
import { Tracking } from "./tracking.js";
import type { IEqualityComparer } from "metano-runtime/system/collections";

let Computed$rt: ClassType<Computed<unknown>> | undefined;

export class Computed<T> extends OwnerNode {
  private readonly _compute: () => T;
  private readonly _comparer: IEqualityComparer<T>;
  private _value: T = null!;

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

    if (!(observer == null)) {
      DependencyGraph.link(this, observer, Tracking.cycle);
    }

    return this._value;
  }

  peek(): T {
    this.refresh();

    return this._value;
  }

  /** @internal */
  update(): boolean {
    this.disposeOwned();
    this.depsTail = null;
    this.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const previousObserver = Tracking.activeObserver;
    const previousOwner = Tracking.currentOwner;
    Tracking.activeObserver = this;
    Tracking.currentOwner = this;
    try {
      Tracking.cycle = (Tracking.cycle + 1) | 0;
      const next = this._compute();

      if (this._comparer.equals(this._value, next)) {
        return false;
      }

      this._value = next;

      return true;
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
      this.flags &= ~ReactiveFlags.RecursedCheck;
      DependencyGraph.purgeDeps(this);
    }
  }

  /** @internal */
  notify(): void {
    throwError(new InvalidOperationException("A computed cannot be notified."));
  }

  /** @internal */
  unwatched(): void {
    if (this.depsTail == null) {
      return;
    }

    this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    DependencyGraph.disposeAllDepsInReverse(this);
    this.disposeOwned();
  }

  /** @internal */
  onDisposed(): void {
    this.depsTail = null;
    this.flags = ReactiveFlags.Mutable;
    DependencyGraph.purgeDeps(this);
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
    if (DependencyGraph.checkDirty(this.deps!, this)) {
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
      this._value = this._compute();
    } finally {
      Tracking.activeObserver = previousObserver;
      Tracking.currentOwner = previousOwner;
      this.flags &= ~ReactiveFlags.RecursedCheck;
    }
  }
}
