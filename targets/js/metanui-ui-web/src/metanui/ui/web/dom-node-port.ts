import type { ClassType } from "metano-runtime";
import { INodePort$runtimeType, type INodePort } from "metanui-ui/metanui/ui";

let DomNodePort$rt: ClassType<DomNodePort> | undefined;

export class DomNodePort implements INodePort {
  static get $runtimeType(): ClassType<DomNodePort> {
    return (DomNodePort$rt ??= {
      kind: "class",
      name: "DomNodePort",
      fullName: "Metanui.Ui.Web.DomNodePort",
      namespace: "Metanui.Ui.Web",
      ctor: DomNodePort,
      interfaces: [
        () => INodePort$runtimeType,
      ],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new DomNodePort(),
      test: (v: unknown): v is DomNodePort => v instanceof DomNodePort,
    });
  }

  createText(text: string): Object {
    return document.createTextNode(text);
  }

  setText(text: Object, value: string): void {
    (text as Text).data = value;
  }

  createAnchor(): Object {
    return document.createComment("");
  }

  insert(parent: Object, node: Object, anchor: Object | null): void {
    (parent as Node).insertBefore(node as Node, anchor as Node);
  }

  remove(parent: Object, node: Object): void {
    (parent as Node).removeChild(node as Node);
  }
}
