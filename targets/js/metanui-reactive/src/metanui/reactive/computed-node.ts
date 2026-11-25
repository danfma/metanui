import type { ClassType } from "metano-runtime";
import { OwnerNode } from "./ownership/owner-node.js";

let ComputedNode$rt: ClassType<ComputedNode> | undefined;

export abstract class ComputedNode extends OwnerNode {
  /** @internal */
  nextRetry: ComputedNode | null = null;

  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<ComputedNode> {
    return (ComputedNode$rt ??= {
      kind: "class",
      name: "ComputedNode",
      fullName: "Metanui.Reactive.ComputedNode",
      namespace: "Metanui.Reactive",
      ctor: ComputedNode,
      base: () => OwnerNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is ComputedNode => v instanceof ComputedNode,
    });
  }

  /** @internal */
  abstract retryAtPassStart(): boolean;
}
