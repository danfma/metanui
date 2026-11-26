import type { ReactiveNode } from "./reactive-node.js";

export class Link {
  declare version: number;
  declare dep: ReactiveNode;
  declare sub: ReactiveNode;
  declare prevSub: Link | null;
  declare nextSub: Link | null;
  declare prevDep: Link | null;
  declare nextDep: Link | null;

  constructor(version: number, dep: ReactiveNode, sub: ReactiveNode, prevDep: Link | null, nextDep: Link | null, prevSub: Link | null) {
    this.version = version;
    this.dep = dep;
    this.sub = sub;
    this.prevSub = prevSub;
    this.nextSub = null;
    this.prevDep = prevDep;
    this.nextDep = nextDep;
  }
}
