import type { INodePort } from "../i-node-port.js";
import { Fragment } from "../regions/fragment.js";
import type { ListRegion } from "./list-region.js";

export class ListItem extends Fragment {
  /** @internal */
  declare previous: ListItem | null;

  /** @internal */
  declare next: ListItem | null;

  declare private readonly _list: ListRegion;

  constructor(port: INodePort, parent: Object, end: Object, list: ListRegion) {
    super(port, parent, end);
    this.previous = null;
    this.next = null;
    this._list = list;
  }

  /** @internal */
  discard(): void {
    this._list.unlink(this);
    this.remove();
  }
}
