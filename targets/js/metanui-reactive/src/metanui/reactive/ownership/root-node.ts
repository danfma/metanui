import { throwError, toException } from "metano-runtime";
import type { Exception } from "metano-runtime/system/exceptions/exception";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import type { ReactiveNode } from "../graph/reactive-node.js";
import { FlushLoop } from "../scheduling/flush-loop.js";
import { Tracking } from "../tracking.js";
import { OwnerNode } from "./owner-node.js";

export class RootNode extends OwnerNode {
  /** @internal */
  readonly underComputation: boolean = false;

  private readonly _errorHandler: ((obj: Exception) => void) | null = null;

  constructor(errorHandler: ((obj: Exception) => void) | null = null) {
    super();
    this.underComputation = RootNode.isUnderComputation(this.parent);
    this._errorHandler = errorHandler;
  }

  /** @internal */
  override get catchesErrors(): boolean {
    return !(this._errorHandler == null);
  }

  /** @internal */
  run<T>(body: (arg: () => void) => T): T {
    const previousOwner = Tracking.currentOwner;
    const previousObserver = Tracking.activeObserver;
    Tracking.currentOwner = this;
    Tracking.activeObserver = null;
    try {
      return body(this.disposeFromCaller.bind(this));
    } finally {
      this.endRun(previousOwner, previousObserver);
    }
  }

  /** @internal */
  runBoundary(body: () => void): void {
    const failure = this.runBoundaryBody(body);

    if (!(failure == null)) {
      this.handleError(failure);
    }
  }

  private runBoundaryBody(body: () => void): Exception | null {
    const previousOwner = Tracking.currentOwner;
    const previousObserver = Tracking.activeObserver;
    Tracking.currentOwner = this;
    Tracking.activeObserver = null;
    try {
      body();

      return null;
    } catch (e$) {
      const e0 = toException(e$);
      const error = e0;

      return error;
    } finally {
      this.endRun(previousOwner, previousObserver);
    }
  }

  private endRun(previousOwner: OwnerNode | null, previousObserver: ReactiveNode | null): void {
    Tracking.currentOwner = previousOwner;
    Tracking.activeObserver = previousObserver;

    if (this.isDisposed) {
      this.disposeOwned();
    }
  }

  /** @internal */
  override update(): boolean {
    return throwError(new InvalidOperationException("A root cannot be updated."));
  }

  /** @internal */
  override notify(): void {
    throwError(new InvalidOperationException("A root cannot be notified."));
  }

  private disposeFromCaller(): void {
    this.dispose();

    if (!FlushLoop.isRunning) {
      OwnerNode.rethrowCleanupErrorUnlessCaught();
    }
  }

  private handleError(error: Exception): void {
    const previousOwner = Tracking.currentOwner;
    const previousObserver = Tracking.activeObserver;
    const previousApply = Tracking.activeApply;
    Tracking.currentOwner = null;
    Tracking.activeObserver = null;
    Tracking.activeApply = null;
    Tracking.errorHandlerDepth = (Tracking.errorHandlerDepth + 1) | 0;
    try {
      this._errorHandler!(error);
    } catch (e$) {
      const e0 = toException(e$);
      const handlerError = e0;

      if (!RootNode.tryRouteError(this.parent, handlerError)) {
        throw e$;
      }
    } finally {
      Tracking.errorHandlerDepth = (Tracking.errorHandlerDepth - 1) | 0;
      Tracking.currentOwner = previousOwner;
      Tracking.activeObserver = previousObserver;
      Tracking.activeApply = previousApply;
    }
  }

  /** @internal */
  static tryRouteError(owner: OwnerNode | null, error: Exception): boolean {
    while (!(owner == null)) {
      let root: RootNode;

      if (owner instanceof RootNode && (root = owner, true) && !(root._errorHandler == null)) {
        root.handleError(error);

        return true;
      }

      owner = owner.parent;
    }

    return false;
  }

  private static isUnderComputation(parent: OwnerNode | null): boolean {
    let root: RootNode;

    return !(parent == null) && (!(parent instanceof RootNode && (root = parent, true)) || root.underComputation);
  }
}
