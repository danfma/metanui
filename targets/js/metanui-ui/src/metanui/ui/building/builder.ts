import type { INodePort } from "../i-node-port.js";
import type { Fragment } from "../regions/fragment.js";
import type { InsertionPoint } from "./insertion-point.js";
import { Scope } from "./scope.js";

export class Builder {
  private static readonly invokeBody: (obj: () => void) => void = (body: () => void) => body();
  private static _current: Scope = Scope.none;

  private constructor() { }

  /** @internal */
  static get target(): InsertionPoint {
    return Builder._current.require();
  }

  static create<TNode>(node: TNode, build: (obj: TNode) => void): void {
    const target = Builder.target;
    Builder.runIn(Scope.building(target.port, node, null, null), build, node);
    target.insert(node);
  }

  static add(node: Object): void {
    Builder.target.insert(node);
  }

  /** @internal */
  static run(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null, body: () => void): void {
    Builder.runIn(Scope.building(port, parent, before, collector), Builder.invokeBody, body);
  }

  /** @internal */
  static runWith<T>(port: INodePort, parent: Object, before: Object | null, collector: Fragment | null, body: (obj: T) => void, argument: T): void {
    Builder.runIn(Scope.building(port, parent, before, collector), body, argument);
  }

  /** @internal */
  static runRejectingChildren<T>(body: (obj: T) => void, argument: T): void {
    Builder.runIn(Scope.rejectingChildren, body, argument);
  }

  private static runIn<T>(scope: Scope, body: (obj: T) => void, argument: T): void {
    const saved = Builder._current;
    Builder._current = scope;
    try {
      body(argument);
    } finally {
      Builder._current = saved;
    }
  }
}
