import { throwError } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Tracking } from "../tracking.js";
import { OwnerNode } from "./owner-node.js";

export class RootNode extends OwnerNode {
  constructor() {
    super();
  }

  /** @internal */
  run<T>(body: (arg: () => void) => T): T {
    const previousOwner = Tracking.currentOwner;
    const previousObserver = Tracking.activeObserver;
    Tracking.currentOwner = this;
    Tracking.activeObserver = null;
    try {
      return body(this.dispose.bind(this));
    } finally {
      Tracking.currentOwner = previousOwner;
      Tracking.activeObserver = previousObserver;
    }
  }

  /** @internal */
  update(): boolean {
    return throwError(new InvalidOperationException("A root cannot be updated."));
  }

  /** @internal */
  notify(): void {
    throwError(new InvalidOperationException("A root cannot be notified."));
  }
}
