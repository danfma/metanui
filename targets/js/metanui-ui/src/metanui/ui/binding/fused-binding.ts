import type { IDisposable } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";

export class FusedBinding {
  private static readonly noApply: (arg1: boolean, arg2: boolean) => void = (_: boolean, _1: boolean) => {
  };

  private constructor() { }

  /** @internal */
  static start(write: () => void): IDisposable {
    return Reactivity.effect(() => {
      write();

      return true;
    }, FusedBinding.noApply);
  }
}
