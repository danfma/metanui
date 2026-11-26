import { throwError, type ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { ReactiveNode } from "./reactive-node.js";

let SignalNode$rt: ClassType<SignalNode> | undefined;

export abstract class SignalNode extends ReactiveNode {
  /** @internal */
  declare nextPending: SignalNode | null;

  constructor() {
    super();
    this.nextPending = null;
  }

  static override get $runtimeType(): ClassType<SignalNode> {
    return (SignalNode$rt ??= {
      kind: "class",
      name: "SignalNode",
      fullName: "Metanui.Reactive.Graph.SignalNode",
      namespace: "Metanui.Reactive.Graph",
      ctor: SignalNode,
      base: () => ReactiveNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is SignalNode => v instanceof SignalNode,
    });
  }

  /** @internal */
  abstract discardPending(): void;

  /** @internal */
  override notify(): void {
    throwError(new InvalidOperationException("A signal cannot be notified."));
  }
}
