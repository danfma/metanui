import type { EffectNode } from "./effects/effect-node.js";
import type { ReactiveNode } from "./graph/reactive-node.js";
import type { OwnerNode } from "./ownership/owner-node.js";

export class Tracking {
  static activeObserver: ReactiveNode | null = null;
  static currentOwner: OwnerNode | null = null;
  static activeApply: EffectNode | null = null;
  static cycle: number = 0;
  static pass: number = 0;
  static dirtyCheckDepth: number = 0;
  static errorHandlerDepth: number = 0;

  private constructor() { }
}
