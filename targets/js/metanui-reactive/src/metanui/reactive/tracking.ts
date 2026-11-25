import type { ReactiveNode } from "./graph/reactive-node.js";

export class Tracking {
  static activeObserver: ReactiveNode | null = null;
  static cycle: number = 0;

  constructor() { }
}
