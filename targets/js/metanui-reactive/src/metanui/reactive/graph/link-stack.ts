import { arrayLength } from "metano-runtime";
import type { Link } from "./link.js";

export class LinkStack {
  private static readonly initialCapacity: number = 16;
  private static _items = /* @__PURE__ */ new Array(LinkStack.initialCapacity).fill(null) as (Link | null)[];
  static top: number = 0;

  private constructor() { }

  static push(link: Link | null): void {
    if (LinkStack.top === LinkStack._items.length) {
      LinkStack.grow();
    }

    LinkStack._items[LinkStack.top] = link;
    LinkStack.top = (LinkStack.top + 1) | 0;
  }

  static pop(): Link | null {
    LinkStack.top = (LinkStack.top - 1) | 0;
    const link = LinkStack._items[LinkStack.top] as Link | null;
    LinkStack._items[LinkStack.top] = null;

    return link;
  }

  static truncate(stackBase: number): void {
    while (LinkStack.top > stackBase) {
      LinkStack.pop();
    }
  }

  private static grow(): void {
    const grown = new Array(arrayLength(Math.imul(LinkStack._items.length, 2))).fill(null);
    for (let index = 0; index < LinkStack._items.length; index++) {
      grown[index] = LinkStack._items[index] as Link | null;
    }
    LinkStack._items = grown;
  }
}
