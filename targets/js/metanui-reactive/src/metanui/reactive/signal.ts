import { defaultEqualityComparerFor, type ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { DependencyGraph } from "./graph/dependency-graph.js";
import { ReactiveFlags } from "./graph/reactive-flags.js";
import { SignalNode } from "./graph/signal-node.js";
import { RootNode } from "./ownership/root-node.js";
import { Teardown } from "./ownership/teardown.js";
import { FlushLoop } from "./scheduling/flush-loop.js";
import { Tracking } from "./tracking.js";
import type { IEqualityComparer } from "metano-runtime/system/collections";

let Signal$rt: ClassType<Signal<unknown>> | undefined;

export class Signal<T> extends SignalNode {
  private static readonly writeInsideComputationMessage: string = "Writing to a signal inside a computation is not allowed; move the write outside.";
  private readonly _comparer: IEqualityComparer<T>;
  private _value: T;
  private _pending: T;
  private _hasPending: boolean = false;

  constructor(initialValue: T, comparer: IEqualityComparer<T> | null = null) {
    super();
    this._comparer = comparer ?? defaultEqualityComparerFor();
    this._value = initialValue;
    this._pending = initialValue;
    this.flags = ReactiveFlags.Mutable;
  }

  static override get $runtimeType(): ClassType<Signal<unknown>> {
    return (Signal$rt ??= {
      kind: "class",
      name: "Signal`1",
      fullName: "Metanui.Reactive.Signal`1",
      namespace: "Metanui.Reactive",
      ctor: Signal,
      base: () => SignalNode.$runtimeType,
      interfaces: [],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is Signal<unknown> => v instanceof Signal,
    });
  }

  get value(): T {
    const observer = Tracking.activeObserver;

    if (!(observer == null)) {
      DependencyGraph.link(this, observer, Tracking.cycle);
    }

    return this._value;
  }

  set value(value: T) {
    if (!(Tracking.currentOwner == null)) {
      Signal.rejectWriteInsideComputation();
    }

    this._pending = value;

    if (!this._hasPending) {
      this._hasPending = true;
      FlushLoop.enqueue(this);
    }

    FlushLoop.requestFlush();
  }

  private static rejectWriteInsideComputation(): void {
    if (Teardown.depth !== 0) {
      return;
    }

    let root: RootNode;

    if (!(Tracking.currentOwner instanceof RootNode && (root = Tracking.currentOwner, true)) || root.underComputation) {
      throw new InvalidOperationException(Signal.writeInsideComputationMessage);
    }
  }

  peek(): T {
    return this._value;
  }

  /** @internal */
  override update(): boolean {
    if (!this._hasPending) {
      return false;
    }

    this._hasPending = false;

    if (this._comparer.equals(this._value, this._pending)) {
      return false;
    }

    this._value = this._pending;

    return true;
  }

  /** @internal */
  override discardPending(): void {
    this._hasPending = false;
    this._pending = this._value;
  }
}
