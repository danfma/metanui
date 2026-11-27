import { castTo, type ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { INodePort$runtimeType, type INodePort } from "metanui-ui/metanui/ui";
import { FakeAnchor } from "./fake-anchor.js";
import { FakeElement } from "./fake-element.js";
import { FakeNode } from "./fake-node.js";
import { FakeText } from "./fake-text.js";

let FakePort$rt: ClassType<FakePort> | undefined;

export class FakePort implements INodePort {
  declare moves: number;

  constructor() {
    this.moves = 0;
  }

  static get $runtimeType(): ClassType<FakePort> {
    return (FakePort$rt ??= {
      kind: "class",
      name: "FakePort",
      fullName: "Metanui.Ui.Scenarios.Fakes.FakePort",
      namespace: "Metanui.Ui.Scenarios.Fakes",
      ctor: FakePort,
      interfaces: [
        () => INodePort$runtimeType,
      ],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new FakePort(),
      test: (v: unknown): v is FakePort => v instanceof FakePort,
    });
  }

  createText(text: string): Object {
    return new FakeText(text);
  }

  setText(text: Object, value: string): void {
    castTo<FakeText>(text, FakeText).value = value;
  }

  createAnchor(): Object {
    return new FakeAnchor();
  }

  insert(parent: Object, node: Object, anchor: Object | null): void {
    const child = castTo<FakeNode>(node, FakeNode);

    if (child.parent != null) {
      this.moves = (this.moves + 1) | 0;
    }

    castTo<FakeElement>(parent, FakeElement).insertBefore(child, castTo<FakeNode>(anchor, FakeNode));
  }

  remove(parent: Object, node: Object): void {
    const child = castTo<FakeNode>(node, FakeNode);

    if (child.parent !== parent) {
      throw new InvalidOperationException("The node to remove is not a child of the parent.");
    }

    castTo<FakeElement>(parent, FakeElement).removeChild(child);
  }
}
