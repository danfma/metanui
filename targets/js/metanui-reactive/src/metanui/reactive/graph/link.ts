import type { ReactiveNode } from "./reactive-node.js";

export class Link {
  version: number = 0;
  dep: ReactiveNode;
  sub: ReactiveNode;
  prevSub: Link | null = null;
  nextSub: Link | null = null;
  prevDep: Link | null = null;
  nextDep: Link | null = null;

  constructor(dep: ReactiveNode, sub: ReactiveNode) {
    this.dep = dep;
    this.sub = sub;
  }
}
