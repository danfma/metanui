import type { ClassType } from "metano-runtime";

let ItemView$rt: ClassType<ItemView> | undefined;

export class ItemView {
  declare readonly node: HTMLElement;
  declare private readonly _dispose: () => void;

  constructor(node: HTMLElement, dispose: () => void) {
    this.node = node;
    this._dispose = dispose;
  }

  static get $runtimeType(): ClassType<ItemView> {
    return (ItemView$rt ??= {
      kind: "class",
      name: "ItemView",
      fullName: "Metanui.Spike.Dsl.Variants.Direct.ItemView",
      namespace: "Metanui.Spike.Dsl.Variants.Direct",
      ctor: ItemView,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is ItemView => v instanceof ItemView,
    });
  }

  dispose(): void {
    this._dispose();
  }
}
