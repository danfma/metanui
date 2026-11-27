import { castTo, type ClassType } from "metano-runtime";
import { INodePortProbe$runtimeType, type INodePortProbe } from "../port-contract/i-node-port-probe.js";
import { FakeAnchor } from "./fake-anchor.js";
import { FakeElement } from "./fake-element.js";
import { FakeText } from "./fake-text.js";

let FakePortProbe$rt: ClassType<FakePortProbe> | undefined;

export class FakePortProbe implements INodePortProbe {
  static get $runtimeType(): ClassType<FakePortProbe> {
    return (FakePortProbe$rt ??= {
      kind: "class",
      name: "FakePortProbe",
      fullName: "Metanui.Ui.Scenarios.Fakes.FakePortProbe",
      namespace: "Metanui.Ui.Scenarios.Fakes",
      ctor: FakePortProbe,
      interfaces: [
        () => INodePortProbe$runtimeType,
      ],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new FakePortProbe(),
      test: (v: unknown): v is FakePortProbe => v instanceof FakePortProbe,
    });
  }

  createParent(): Object {
    return new FakeElement("parent");
  }

  childCount(parent: Object): number {
    return castTo<FakeElement>(parent, FakeElement).childCount;
  }

  childAt(parent: Object, index: number): Object {
    return castTo<FakeElement>(parent, FakeElement).childAt(index);
  }

  isAnchor(node: Object): boolean {
    return node instanceof FakeAnchor;
  }

  textOf(node: Object): string {
    return castTo<FakeText>(node, FakeText).value;
  }
}
