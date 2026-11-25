import { EffectNode } from "./effect-node.js";

export class SplitEffect<T> extends EffectNode {
  private readonly _compute: () => T;
  private readonly _apply: (arg1: T, arg2: T | null) => void;
  private _value: T = null!;
  private _applied: T | null = null;

  constructor(compute: () => T, apply: (arg1: T, arg2: T | null) => void) {
    super();
    this._compute = compute;
    this._apply = apply;
  }

  protected compute(): void {
    this._value = this._compute();
  }

  protected apply(): void {
    const previous = this._applied;
    this._applied = this._value;
    this._apply(this._value, previous);
  }
}
