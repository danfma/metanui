import type { EffectNode } from "./effects/effect-node.js";
import type { ReactiveNode } from "./graph/reactive-node.js";

export class Tracking {
  static activeObserver: ReactiveNode | null = null;
  static cycle: number = 0;
  static activeApply: EffectNode | null = null;

  constructor() { }
}
