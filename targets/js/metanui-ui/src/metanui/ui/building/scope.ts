import { HashCode, copyRecordWith, formatBoolean, throwError, valueEquals } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import type { INodePort } from "../i-node-port.js";
import type { Fragment } from "../regions/fragment.js";
import { InsertionPoint } from "./insertion-point.js";

export class Scope {
  declare readonly target: InsertionPoint | null;
  declare readonly rejection: string;
  declare readonly inPropsLambda: boolean;
  private static readonly noBuilderMessage: string = "No builder is active: create nodes inside View.Render or inside an element's builder.";
  private static readonly childrenGoInContentMessage: string = "Children go in Content: a component's props lambda only sets props; assign the children to Content.";
  private static readonly bindingInPropsLambdaMessage: string = "A binding in a component's props lambda is lost: Render reads the props once. Assign View.Live(() => ...) to the prop instead.";
  static readonly none = /* @__PURE__ */ new Scope(null, Scope.noBuilderMessage, false) as Scope;
  static readonly rejectingChildren = /* @__PURE__ */ new Scope(null, Scope.childrenGoInContentMessage, true) as Scope;

  constructor(target: InsertionPoint | null, rejection: string, inPropsLambda: boolean) {
    this.target = target;
    this.rejection = rejection;
    this.inPropsLambda = inPropsLambda;
  }

  static building(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null): Scope {
    return new Scope(new InsertionPoint(port, parent, before, collector), Scope.noBuilderMessage, false);
  }

  require(): InsertionPoint {
    return this.target ?? throwError(new InvalidOperationException(this.rejection));
  }

  rejectBinding(): void {
    if (this.inPropsLambda) {
      throw new InvalidOperationException(Scope.bindingInPropsLambdaMessage);
    }
  }

  equals(other: any): boolean {
    return other != null && Object.getPrototypeOf(other) === Object.getPrototypeOf(this) && valueEquals(this.target, other.target) && this.rejection === other.rejection && this.inPropsLambda === other.inPropsLambda;
  }

  hashCode(): number {
    const hc = new HashCode();
    hc.add(this.target);
    hc.add(this.rejection);
    hc.add(this.inPropsLambda);

    return hc.toHashCode();
  }

  with(overrides?: Partial<Scope>): Scope {
    return copyRecordWith<Scope>(this, overrides);
  }

  toString(): string {
    return `Scope { Target = ${this.target ?? ""}, Rejection = ${this.rejection}, InPropsLambda = ${formatBoolean(this.inPropsLambda)} }`;
  }
}
