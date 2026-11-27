import { List, throwModified } from "metano-runtime/system/collections";
import type { INodePort } from "../i-node-port.js";
import { Region } from "./region.js";

export class Fragment extends Region {
  declare private readonly _parts: List<Object>;
  declare private readonly _end: Object | null;

  constructor(port: INodePort, parent: Object, end: Object | null) {
    super(port, parent);
    this._parts = List.of<Object>([]);
    this._end = end;
  }

  /** @internal */
  get end(): Object | null {
    return this._end;
  }

  /** @internal */
  override get firstNode(): Object | null {
    return this._parts.count === 0 ? this._end : Fragment.firstNodeOf(this._parts.get(0));
  }

  /** @internal */
  add(part: Object): void {
    this._parts.add(part);
  }

  /** @internal */
  override moveBefore(anchor: Object | null): void {
    {
      const $c = typeof __METANO_CHECKS__ === "undefined" || __METANO_CHECKS__;
      const $l = this._parts;
      const $a = $l._items;
      const $n = $a.length;
      const $v = $c ? $l._version : 0;
      for (let $i = 0; ; $i++) {
        if ($c && ($l._version !== $v || $a.length !== $n)) throwModified();
        if ($i === $n) break;
        const part = $a[$i]!;
        let region: Region;

        if (part instanceof Region && (region = part, true)) {
          region.moveBefore(anchor);
        } else {
          this.port.insert(this.parent, part, anchor);
        }
      }
    }

    if (this._end != null) {
      this.port.insert(this.parent, this._end, anchor);
    }
  }

  /** @internal */
  remove(): void {
    {
      const $c = typeof __METANO_CHECKS__ === "undefined" || __METANO_CHECKS__;
      const $l = this._parts;
      const $a = $l._items;
      const $n = $a.length;
      const $v = $c ? $l._version : 0;
      for (let $i = 0; ; $i++) {
        if ($c && ($l._version !== $v || $a.length !== $n)) throwModified();
        if ($i === $n) break;
        const part = $a[$i]!;
        if (!(part instanceof Region)) {
          this.port.remove(this.parent, part);
        }
      }
    }

    if (this._end != null) {
      this.port.remove(this.parent, this._end);
    }
  }

  private static firstNodeOf(part: Object): Object | null {
    let region: Region;

    return part instanceof Region && (region = part, true) ? region.firstNode : part;
  }
}
