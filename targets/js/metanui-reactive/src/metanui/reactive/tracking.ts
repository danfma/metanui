import type { ReactiveNode } from "./graph/reactive-node.js";

export class Tracking {
  static observer: ReactiveNode | null = null;

  constructor() { }
}
