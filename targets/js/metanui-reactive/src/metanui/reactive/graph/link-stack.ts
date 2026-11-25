import type { Link } from "./link.js";

export class LinkStack {
  readonly value: Link | null;
  readonly prev: LinkStack | null;

  constructor(value: Link | null, prev: LinkStack | null) {
    this.value = value;
    this.prev = prev;
  }
}
