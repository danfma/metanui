import { IDisposable$runtimeType, type ClassType } from "metano-runtime";
import { EffectNode } from "./effect-node.js";

let SplitEffect$rt: ClassType<SplitEffect<unknown>> | undefined;

export class SplitEffect<T> extends EffectNode {
  declare private _compute: (() => T) | null;
  declare private _apply: ((arg1: T, arg2: T) => void) | null;
  declare private _value: T;
  declare private _applied: T;
  declare private _hasApplied: boolean;

  constructor(compute: () => T, apply: (arg1: T, arg2: T) => void) {
    super();
    this._compute = compute;
    this._apply = apply;
    this._value = null!;
    this._applied = null!;
    this._hasApplied = false;
  }

  static override get $runtimeType(): ClassType<SplitEffect<unknown>> {
    return (SplitEffect$rt ??= {
      kind: "class",
      name: "SplitEffect`1",
      fullName: "Metanui.Reactive.Effects.SplitEffect`1",
      namespace: "Metanui.Reactive.Effects",
      ctor: SplitEffect,
      base: () => EffectNode.$runtimeType,
      interfaces: [
        () => IDisposable$runtimeType,
      ],
      typeParameters: ["T"],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is SplitEffect<unknown> => v instanceof SplitEffect,
    });
  }

  protected override compute(): void {
    const value = this._compute!();

    if (!this.isDisposed) {
      this._value = value;
    }
  }

  protected override apply(): void {
    const previous = this._hasApplied ? this._applied : this._value;
    this._applied = this._value;
    this._hasApplied = true;
    this._apply!(this._value, previous);
  }

  protected override releaseUserState(): void {
    this._compute = null;
    this._apply = null;
    this._value = null!;
    this._applied = null!;
  }
}
