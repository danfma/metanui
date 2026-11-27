import type { ClassType } from "metano-runtime";
import { FakeNode } from "./fake-node.js";

let FakeAnchor$rt: ClassType<FakeAnchor> | undefined;

export class FakeAnchor extends FakeNode {
  constructor() {
    super();
  }

  static override get $runtimeType(): ClassType<FakeAnchor> {
    return (FakeAnchor$rt ??= {
      kind: "class",
      name: "FakeAnchor",
      fullName: "Metanui.Ui.Scenarios.Fakes.FakeAnchor",
      namespace: "Metanui.Ui.Scenarios.Fakes",
      ctor: FakeAnchor,
      base: () => FakeNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new FakeAnchor(),
      test: (v: unknown): v is FakeAnchor => v instanceof FakeAnchor,
    });
  }

  override print(): string {
    return "";
  }
}
