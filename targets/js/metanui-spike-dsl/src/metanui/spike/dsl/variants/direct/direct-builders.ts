import { throwError } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import type { HTMLElement } from "metanui-spike-counter/metanui/spike/counter/dom";
import { El } from "../../core/el.js";
import type { Part } from "../../core/part.js";
import type { Component } from "./component.js";

export class DirectBuilders {
  private static _current: HTMLElement | null = null;

  private constructor() { }

  static section(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("section", build);
  }

  static div(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("div", build);
  }

  static h2(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("h2", build);
  }

  static p(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("p", build);
  }

  static button(build: (obj: HTMLElement) => void): El {
    return DirectBuilders.create("button", build);
  }

  static add(part: Part): void {
    part.attachTo(DirectBuilders._current ?? throwError(new InvalidOperationException("Add runs only inside an element builder.")));
  }

  static mount<TComponent extends Component<TComponent>>(component: TComponent, build: (obj: TComponent) => void): El {
    const parent = DirectBuilders._current;
    const content = document.createElement("div");
    DirectBuilders._current = content;
    try {
      build(component);
    } finally {
      DirectBuilders._current = null;
    }
    try {
      const root = component.render(new El(content));
      parent?.appendChild(root.node);

      return root;
    } finally {
      DirectBuilders._current = parent;
    }
  }

  private static create(tagName: string, build: (obj: HTMLElement) => void): El {
    const node = document.createElement(tagName);
    const parent = DirectBuilders._current;
    DirectBuilders._current = node;
    try {
      build(node);
    } finally {
      DirectBuilders._current = parent;
    }
    parent?.appendChild(node);

    return new El(node);
  }
}
