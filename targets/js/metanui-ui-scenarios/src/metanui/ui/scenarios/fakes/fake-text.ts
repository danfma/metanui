import type { ClassType } from "metano-runtime";
import { FakeNode } from "./fake-node.js";

let FakeText$rt: ClassType<FakeText> | undefined;

export class FakeText extends FakeNode {
  declare value: string;

  constructor(value: string) {
    super();
    this.value = value;
  }

  static override get $runtimeType(): ClassType<FakeText> {
    return (FakeText$rt ??= {
      kind: "class",
      name: "FakeText",
      fullName: "Metanui.Ui.Scenarios.Fakes.FakeText",
      namespace: "Metanui.Ui.Scenarios.Fakes",
      ctor: FakeText,
      base: () => FakeNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is FakeText => v instanceof FakeText,
    });
  }

  override print(): string {
    return `'${this.value}'`;
  }
}
