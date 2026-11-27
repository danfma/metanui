import { HashCode, copyRecordWith, throwError, valueEquals } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import type { INodePort } from "../i-node-port.js";
import type { Fragment } from "../regions/fragment.js";
import { InsertionPoint } from "./insertion-point.js";

export class Scope {
  declare readonly target: InsertionPoint | null;
  declare readonly rejection: string;
  private static readonly noBuilderMessage: string = "No builder is active: create nodes inside View.Render or inside an element's builder.";
  private static readonly childrenGoInContentMessage: string = "Children go in Content: a component's props lambda only sets props; assign the children to Content.";
  static readonly none = /* @__PURE__ */ new Scope(null, Scope.noBuilderMessage) as Scope;
  static readonly rejectingChildren = /* @__PURE__ */ new Scope(null, Scope.childrenGoInContentMessage) as Scope;

  constructor(target: InsertionPoint | null, rejection: string) {
    this.target = target;
    this.rejection = rejection;
  }

  static building(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null): Scope {
    return new Scope(new InsertionPoint(port, parent, before, collector), Scope.noBuilderMessage);
  }

  require(): InsertionPoint {
    return this.target ?? throwError(new InvalidOperationException(this.rejection));
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && valueEquals(this.target, other.target) && this.rejection === other.rejection;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.target);
    hc.add(this.rejection);

    return hc.toHashCode();
  }

  with(overrides?: Partial<Scope>): Scope {
    return copyRecordWith<Scope>(this, overrides);
  }

  toString(): string {
    return `Scope { Target = ${this.target ?? ""}, Rejection = ${this.rejection} }`;
  }
}
