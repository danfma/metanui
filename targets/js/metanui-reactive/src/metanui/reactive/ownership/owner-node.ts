import type { ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { DependencyGraph } from "../graph/dependency-graph.js";
import { ReactiveFlags } from "../graph/reactive-flags.js";
import { ReactiveNode } from "../graph/reactive-node.js";
import { Tracking } from "../tracking.js";
import { CleanupEntry } from "./cleanup-entry.js";
import { Teardown } from "./teardown.js";

let OwnerNode$rt: ClassType<OwnerNode> | undefined;

export abstract class OwnerNode extends ReactiveNode {
  private static readonly creationInsideApplyMessage: string = "Cannot create a computed, effect or root inside an effect's apply: the apply has no owner, so " + "nothing would ever dispose it. Create it in the compute instead.";

  /** @internal */
  parent: OwnerNode | null = null;

  /** @internal */
  firstChild: OwnerNode | null = null;

  /** @internal */
  nextSibling: OwnerNode | null = null;

  /** @internal */
  prevSibling: OwnerNode | null = null;

  /** @internal */
  cleanups: CleanupEntry | null = null;

  /** @internal */
  isDisposed: boolean = false;

  /** @internal */
  nextDeferredUnlink: OwnerNode | null = null;

  private static _deferredUnlinks: OwnerNode | null = null;

  constructor() {
    super();
    const parent = Tracking.currentOwner;

    if (!(parent == null)) {
      this.attachTo(parent);
    } else {
      if (!(Tracking.activeApply == null)) {
        throw new InvalidOperationException(OwnerNode.creationInsideApplyMessage);
      }
    }
  }

  static override get $runtimeType(): ClassType<OwnerNode> {
    return (OwnerNode$rt ??= {
      kind: "class",
      name: "OwnerNode",
      fullName: "Metanui.Reactive.Ownership.OwnerNode",
      namespace: "Metanui.Reactive.Ownership",
      ctor: OwnerNode,
      base: () => ReactiveNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is OwnerNode => v instanceof OwnerNode,
    });
  }

  /** @internal */
  get catchesErrors(): boolean {
    return true;
  }

  /** @internal */
  static rethrowCleanupErrorUnlessCaught(): void {
    if (Tracking.errorHandlerDepth === 0 && !OwnerNode.isCaughtByOwner(Tracking.currentOwner)) {
      Teardown.rethrowFirstError();
    }
  }

  /** @internal */
  addCleanup(cleanup: () => void): void {
    this.cleanups = new CleanupEntry(cleanup, this.cleanups);
  }

  /** @internal */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.detach();
    this.disposeOwned();
    this.onDisposed();
  }

  /** @internal */
  disposeOwned(): void {
    let child = this.firstChild;
    this.firstChild = null;
    while (!(child == null)) {
      child.parent = null;
      child.prevSibling = null;
      child.dispose();
      const next = child.nextSibling;
      child.nextSibling = null;
      child = next;
    }
    const cleanups = this.cleanups;
    this.cleanups = null;
    Teardown.run(cleanups);
  }

  /** @internal */
  onDisposed(): void {
  }

  /** @internal */
  unlinkDependenciesOnDisposal(): void {
    if (Tracking.dirtyCheckDepth === 0) {
      DependencyGraph.purgeDeps(this);

      return;
    }

    this.nextDeferredUnlink = OwnerNode._deferredUnlinks;
    OwnerNode._deferredUnlinks = this;
  }

  /** @internal */
  isAnyDependencyDirty(): boolean {
    Tracking.dirtyCheckDepth = (Tracking.dirtyCheckDepth + 1) | 0;
    try {
      return DependencyGraph.checkDirty(this.deps!, this);
    } finally {
      Tracking.dirtyCheckDepth = (Tracking.dirtyCheckDepth - 1) | 0;

      if (Tracking.dirtyCheckDepth === 0 && !(OwnerNode._deferredUnlinks == null)) {
        OwnerNode.unlinkDeferredDependencies();
      }
    }
  }

  /** @internal */
  purgeStaleDeps(): void {
    if (this.isDisposed) {
      this.depsTail = null;
      this.flags &= ReactiveFlags.Mutable | ReactiveFlags.Errored;
      this.disposeOwned();
    }

    DependencyGraph.purgeDeps(this);
  }

  private static unlinkDeferredDependencies(): void {
    while (!(OwnerNode._deferredUnlinks == null)) {
      const node = OwnerNode._deferredUnlinks;
      OwnerNode._deferredUnlinks = node.nextDeferredUnlink;
      node.nextDeferredUnlink = null;
      node.depsTail = null;
      node.flags &= ReactiveFlags.Mutable | ReactiveFlags.Errored;
      DependencyGraph.purgeDeps(node);
    }
  }

  private static isCaughtByOwner(owner: OwnerNode | null): boolean {
    while (!(owner == null)) {
      if (owner.catchesErrors) {
        return true;
      }

      owner = owner.parent;
    }

    return false;
  }

  private attachTo(parent: OwnerNode): void {
    const head = parent.firstChild;
    this.parent = parent;
    this.nextSibling = head;

    if (!(head == null)) {
      head.prevSibling = this;
    }

    parent.firstChild = this;
  }

  private detach(): void {
    const parent = this.parent;

    if (parent == null) {
      return;
    }

    const previous = this.prevSibling;
    const next = this.nextSibling;
    this.parent = null;
    this.prevSibling = null;
    this.nextSibling = null;

    if (previous == null) {
      parent.firstChild = next;
    } else {
      previous.nextSibling = next;
    }

    if (!(next == null)) {
      next.prevSibling = previous;
    }
  }
}
