import type { ClassType } from "metano-runtime";
import type { FakeElement } from "./fake-element.js";

let FakeNode$rt: ClassType<FakeNode> | undefined;

export abstract class FakeNode {
  declare parent: FakeElement | null;

  constructor() {
    this.parent = null;
  }

  static get $runtimeType(): ClassType<FakeNode> {
    return (FakeNode$rt ??= {
      kind: "class",
      name: "FakeNode",
      fullName: "Metanui.Ui.Scenarios.Fakes.FakeNode",
      namespace: "Metanui.Ui.Scenarios.Fakes",
      ctor: FakeNode,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is FakeNode => v instanceof FakeNode,
    });
  }

  abstract print(): string;
}
