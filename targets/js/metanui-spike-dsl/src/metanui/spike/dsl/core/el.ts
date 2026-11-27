import type { ClassType } from "metano-runtime";
import { Part } from "./part.js";

let El$rt: ClassType<El> | undefined;

export class El extends Part {
  declare readonly node: HTMLElement;

  constructor(node: HTMLElement) {
    super();
    this.node = node;
  }

  static override get $runtimeType(): ClassType<El> {
    return (El$rt ??= {
      kind: "class",
      name: "El",
      fullName: "Metanui.Spike.Dsl.Core.El",
      namespace: "Metanui.Spike.Dsl.Core",
      ctor: El,
      base: () => Part.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is El => v instanceof El,
    });
  }

  override attachTo(parent: HTMLElement): void {
    parent.appendChild(this.node);
  }

  static create(tagName: string, parts: Part[]): El {
    const element = new El(document.createElement(tagName));
    for (const part of parts) {
      part.attachTo(element.node);
    }

    return element;
  }
}
