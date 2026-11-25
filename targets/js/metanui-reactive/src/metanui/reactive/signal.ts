import { defaultEqualityComparerFor, type ClassType } from "metano-runtime";
import { ReactiveFlags } from "./graph/reactive-flags.js";
import { SignalNode } from "./graph/signal-node.js";
import { FlushLoop } from "./scheduling/flush-loop.js";
import type { IEqualityComparer } from "metano-runtime/system/collections";

let Signal$rt: ClassType<Signal<unknown>> | undefined;

export class Signal<T> extends SignalNode {
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
    return this._value;
  }

  set value(value: T) {
    this._pending = value;

    if (this._hasPending) {
      return;
    }

    this._hasPending = true;
    this.queue();
  }

  private queue(): void {
    FlushLoop.enqueue(this);
  }

  peek(): T {
    return this._value;
  }

  /** @internal */
  update(): boolean {
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
  commitPending(): void {
    this.update();
  }
}
