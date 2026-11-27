import { List, throwModified } from "metano-runtime/system/collections";
import type { ClassType } from "metano-runtime";
import { El } from "../../core/el.js";
import { Part } from "../../core/part.js";

let ElementBuilder$rt: ClassType<ElementBuilder> | undefined;

export abstract class ElementBuilder extends Part implements Iterable<Part> {
  declare private readonly _children: List<Part>;
  declare private readonly _tagName: string;
  declare private readonly _attributes: Part[];

  constructor(tagName: string, attributes: Part[]) {
    super();
    this._children = List.of<Part>([]);
    this._tagName = tagName;
    this._attributes = attributes;
  }

  static override get $runtimeType(): ClassType<ElementBuilder> {
    return (ElementBuilder$rt ??= {
      kind: "class",
      name: "ElementBuilder",
      fullName: "Metanui.Spike.Dsl.Variants.Initializers.ElementBuilder",
      namespace: "Metanui.Spike.Dsl.Variants.Initializers",
      ctor: ElementBuilder,
      base: () => Part.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is ElementBuilder => v instanceof ElementBuilder,
    });
  }

  add(child: Part): void {
    this._children.add(child);
  }

  getEnumerator(): Iterator<Part> {
    return this._children[Symbol.iterator]();
  }

  override attachTo(parent: HTMLElement): void {
    const element = El.create(this._tagName, this._attributes);
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
        child.attachTo(element.node);
      }
    }
    element.attachTo(parent);
  }

  [Symbol.iterator](): Iterator<Part> {
    return this.getEnumerator();
  }
}
