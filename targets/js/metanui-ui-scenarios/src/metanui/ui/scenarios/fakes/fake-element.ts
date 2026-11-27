import { List, throwModified } from "metano-runtime/system/collections";
import type { ClassType } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { FakeNode } from "./fake-node.js";

let FakeElement$rt: ClassType<FakeElement> | undefined;

export class FakeElement extends FakeNode {
  declare readonly tag: string;
  declare private readonly _children: List<FakeNode>;
  declare text: string;

  constructor(tag: string) {
    super();
    this.tag = tag;
    this._children = List.of<FakeNode>([]);
    this.text = "";
  }

  static override get $runtimeType(): ClassType<FakeElement> {
    return (FakeElement$rt ??= {
      kind: "class",
      name: "FakeElement",
      fullName: "Metanui.Ui.Scenarios.Fakes.FakeElement",
      namespace: "Metanui.Ui.Scenarios.Fakes",
      ctor: FakeElement,
      base: () => FakeNode.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is FakeElement => v instanceof FakeElement,
    });
  }

  get childCount(): number {
    return this._children.count;
  }

  childAt(index: number): FakeNode {
    return this._children.get(index);
  }

  override print(): string {
    const text = this.text.length === 0 ? "" : `"${this.text}"`;
    const children = this.printChildren();
    const content = children.length === 0 ? "" : `(${children ?? ""})`;

    return `${this.tag}${text ?? ""}${content ?? ""}`;
  }

  printChildren(): string {
    let printed = "";
    {
      const $c = typeof __METANO_CHECKS__ === "undefined" || __METANO_CHECKS__;
      const $l = this._children;
      const $a = $l._items;
      const $n = $a.length;
      const $v = $c ? $l._version : 0;
      for (let $i = 0; ; $i++) {
        if ($c && ($l._version !== $v || $a.length !== $n)) throwModified();
        if ($i === $n) break;
        const child = $a[$i]!;
        const part = child.print();

        if (part.length === 0) {
          continue;
        }

        printed = printed.length === 0 ? part : `${printed ?? ""} ${part ?? ""}`;
      }
    }

    return printed;
  }

  /** @internal */
  insertBefore(node: FakeNode, anchor: FakeNode | null): void {
    node.parent?.removeChild(node);
    const index = anchor == null ? this._children.count : this.indexOf(anchor);
    this._children.insert(index, node);
    node.parent = this;
  }

  /** @internal */
  removeChild(node: FakeNode): void {
    this._children.removeAt(this.indexOf(node));
    node.parent = null;
  }

  private indexOf(node: FakeNode): number {
    const index = this._children.indexOf(node);

    if (index < 0) {
      throw new InvalidOperationException(`The node is not a child of ${this.tag}.`);
    }

    return index;
  }
}
