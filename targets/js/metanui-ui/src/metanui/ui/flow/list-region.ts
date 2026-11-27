import type { IReadOnlyList } from "metano-runtime/system/collections";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { FusedBinding } from "../binding/fused-binding.js";
import { Builder } from "../building/builder.js";
import type { INodePort } from "../i-node-port.js";
import { Region } from "../regions/region.js";
import { ListItem } from "./list-item.js";

export class ListRegion extends Region {
  declare private _first: ListItem | null;
  declare private _last: ListItem | null;
  declare private _arranged: IReadOnlyList<ListItem> | null;
  declare private readonly _end: Object;

  constructor(port: INodePort, parent: Object, end: Object) {
    super(port, parent);
    this._first = null;
    this._last = null;
    this._arranged = null;
    this._end = end;
  }

  /** @internal */
  override get firstNode(): Object | null {
    return this._first == null ? this._end : this._first.firstNode;
  }

  /** @internal */
  static start<T, TKey>(items: () => IReadOnlyList<T>, key: (arg: T) => TKey, render: (obj: T) => void): void {
    const port = Builder.port;
    const anchor = port.createAnchor();
    const list = new ListRegion(port, Builder.parent, anchor);
    Builder.addRegion(list, anchor);
    Reactivity.onCleanup(list.removeEnd.bind(list));
    const mapped = Reactivity.mapSourceKeyMap<T, TKey, ListItem>(items, key, (item: T) => list.renderItem(render, item));
    FusedBinding.start(() => list.arrange(mapped()));
  }

  /** @internal */
  override moveBefore(anchor: Object | null): void {
    for (let item: ListItem | null = this._first; item != null; item = item.next) {
      item.moveBefore(anchor);
    }
    this.port.insert(this.parent, this._end, anchor);
  }

  /** @internal */
  unlink(item: ListItem): void {
    if (item.previous == null) {
      this._first = item.next;
    } else {
      item.previous.next = item.next;
    }

    if (item.next == null) {
      this._last = item.previous;
    } else {
      item.next.previous = item.previous;
    }

    item.previous = null;
    item.next = null;
  }

  private renderItem<T>(render: (obj: T) => void, value: T): ListItem {
    const item = new ListItem(this.port, this.parent, this.port.createAnchor(), this);
    this.port.insert(this.parent, item.end!, this._end);
    this.linkBefore(item, null);
    Reactivity.onCleanup(item.discard.bind(item));
    Builder.runPortParentBeforeCollectorBodyArgument<T>(this.port, this.parent, item.end, item, render, value);

    return item;
  }

  private arrange(items: IReadOnlyList<ListItem>): void {
    if ((items === this._arranged)) {
      return;
    }

    this._arranged = items;
    let next = null as ListItem | null;
    for (let index = (items.count - 1) | 0; index >= 0; index--) {
      const item = items.get(index);

      if (item.next !== next) {
        item.moveBefore(next == null ? this._end : next!.firstNode);
        this.unlink(item);
        this.linkBefore(item, next);
      }

      next = item;
    }
  }

  private linkBefore(item: ListItem, next: ListItem | null): void {
    const previous = next == null ? this._last : next.previous;
    item.previous = previous;
    item.next = next;

    if (previous == null) {
      this._first = item;
    } else {
      previous.next = item;
    }

    if (next == null) {
      this._last = item;
    } else {
      next.previous = item;
    }
  }

  private removeEnd(): void {
    this.port.remove(this.parent, this._end);
  }
}
