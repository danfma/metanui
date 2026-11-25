import type { ReactiveNode } from "./reactive-node.js";

export class Link {
  version: number;
  dep: ReactiveNode;
  sub: ReactiveNode;
  prevSub: Link | null;
  nextSub: Link | null = null;
  prevDep: Link | null;
  nextDep: Link | null;

  constructor(version: number, dep: ReactiveNode, sub: ReactiveNode, prevDep: Link | null, nextDep: Link | null, prevSub: Link | null) {
    this.version = version;
    this.dep = dep;
    this.sub = sub;
    this.prevDep = prevDep;
    this.nextDep = nextDep;
    this.prevSub = prevSub;
  }
}
