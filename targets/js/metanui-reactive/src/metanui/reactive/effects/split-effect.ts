import { EffectNode } from "./effect-node.js";

export class SplitEffect<T> extends EffectNode {
  private _compute: (() => T) | null;
  private _apply: ((arg1: T, arg2: T) => void) | null;
  private _value: T = null!;
  private _applied: T = null!;
  private _hasApplied: boolean = false;

  constructor(compute: () => T, apply: (arg1: T, arg2: T) => void) {
    super();
    this._compute = compute;
    this._apply = apply;
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
