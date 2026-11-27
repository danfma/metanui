import { HashCode, copyRecordWith, defaultEquals, objectText } from "metano-runtime";
import type { INodePort } from "../i-node-port.js";
import type { Fragment } from "../regions/fragment.js";
import type { Region } from "../regions/region.js";

export class InsertionPoint {
  declare readonly port: INodePort;
  declare readonly parent: Object;
  declare readonly before: Object | null;
  declare readonly collector: Fragment | null;

  constructor(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null) {
    this.port = port;
    this.parent = parent;
    this.before = before;
    this.collector = collector;
  }

  insert(node: Object): void {
    this.port.insert(this.parent, node, this.before);
    this.collector?.add(node);
  }

  insertRegion(region: Region, end: Object): void {
    this.port.insert(this.parent, end, this.before);
    this.collector?.add(region);
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && defaultEquals(this.port, other.port) && defaultEquals(this.parent, other.parent) && defaultEquals(this.before, other.before) && defaultEquals(this.collector, other.collector);
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.port);
    hc.add(this.parent);
    hc.add(this.before);
    hc.add(this.collector);

    return hc.toHashCode();
  }

  with(overrides?: Partial<InsertionPoint>): InsertionPoint {
    return copyRecordWith<InsertionPoint>(this, overrides);
  }

  toString(): string {
    return `InsertionPoint { Port = ${this.port}, Parent = ${objectText(this.parent ?? "")}, Before = ${objectText(this.before ?? "")}, Collector = ${this.collector ?? ""} }`;
  }
}
