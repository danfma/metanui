import { throwError, type ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { OwnerNode } from "./owner-node.js";

let ScopeOwner$rt: ClassType<ScopeOwner> | undefined;

export class ScopeOwner extends OwnerNode {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<ScopeOwner> {
    return (ScopeOwner$rt ??= {
      kind: "class",
      name: "ScopeOwner",
      fullName: "Metanui.Reactive.Ownership.ScopeOwner",
      namespace: "Metanui.Reactive.Ownership",
      ctor: ScopeOwner,
      base: () => OwnerNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new ScopeOwner(),
      test: (v: unknown): v is ScopeOwner => v instanceof ScopeOwner,
    });
  }

  /** @internal */
  override get catchesErrors(): boolean {
    return true;
  }

  /** @internal */
  override refresh(): boolean {
    return throwError(new InvalidOperationException("A scope owner cannot be refreshed."));
  }

  /** @internal */
  override notify(): void {
    throwError(new InvalidOperationException("A scope owner cannot be notified."));
  }
}
