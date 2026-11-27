import { throwError, type ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { OwnerNode } from "../ownership/owner-node.js";

let MapOwner$rt: ClassType<MapOwner> | undefined;

export class MapOwner extends OwnerNode {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<MapOwner> {
    return (MapOwner$rt ??= {
      kind: "class",
      name: "MapOwner",
      fullName: "Metanui.Reactive.Mapping.MapOwner",
      namespace: "Metanui.Reactive.Mapping",
      ctor: MapOwner,
      base: () => OwnerNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new MapOwner(),
      test: (v: unknown): v is MapOwner => v instanceof MapOwner,
    });
  }

  /** @internal */
  override get catchesErrors(): boolean {
    return false;
  }

  /** @internal */
  override update(): boolean {
    return throwError(new InvalidOperationException("A map owner cannot be updated."));
  }

  /** @internal */
  override notify(): void {
    throwError(new InvalidOperationException("A map owner cannot be notified."));
  }
}
