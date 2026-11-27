import { throwError } from "metano-runtime";
import { InvalidOperationException } from "metano-runtime/system/exceptions/invalid-operation-exception";
import { Reactivity, Signal } from "metanui-reactive/metanui/reactive";
import { El } from "../../core/el.js";
import type { Part } from "../../core/part.js";
import { Binding } from "./binding.js";
import { ElementScope } from "./element-scope.js";
import { TextTemplate } from "./text-template.js";

export class Builders {
  private static _current: ElementScope | null = null;

  private constructor() { }

  static section(build: (obj: ElementScope) => void): El {
    return Builders.create("section", build);
  }

  static h2(build: (obj: ElementScope) => void): El {
    return Builders.create("h2", build);
  }

  static p(build: (obj: ElementScope) => void): El {
    return Builders.create("p", build);
  }

  static button(build: (obj: ElementScope) => void): El {
    return Builders.create("button", build);
  }

  static add(part: Part): void {
    part.attachTo(Builders.currentScope().node);
  }

  static bindSignalOfTActionOfT<T>(source: Signal<T>, apply: (obj: T) => void): void {
    Reactivity.effect(() => source.value, (value: T, previous: T) => apply(value));
  }

  static bindSignalOfTAction<T>(source: Signal<T>, apply: () => void): void {
    Reactivity.effect(() => source.value, (value: T, previous: T) => apply());
  }

  static bindFuncOfT<T>(read: () => T): Binding<T> {
    return new Binding(read);
  }

  static bindTextTemplate(template: TextTemplate): Binding<string> {
    return new Binding(template.render.bind(template));
  }

  static bind<T>(source: Signal<T>, apply: (obj: T) => void): void;
  static bind<T>(source: Signal<T>, apply: () => void): void;
  static bind<T>(read: () => T): Binding<T>;
  static bind(template: TextTemplate): Binding<string>;
  static bind(...args: unknown[]): any {
    if (args.length === 2 && args[0] instanceof Signal && typeof args[1] === "function" && args[1].length >= 1) {
      Builders.bindSignalOfTActionOfT(args[0] as any, args[1] as any);

      return;
    }

    if (args.length === 2 && args[0] instanceof Signal && typeof args[1] === "function" && args[1].length < 1) {
      Builders.bindSignalOfTAction(args[0] as any, args[1] as any);

      return;
    }

    if (args.length === 1 && typeof args[0] === "function") {
      return Builders.bindFuncOfT(args[0] as any);
    }

    if (args.length === 1 && args[0] instanceof TextTemplate) {
      return Builders.bindTextTemplate(args[0] as TextTemplate);
    }

    throw new Error("No matching overload for bind");
  }

  private static create(tagName: string, build: (obj: ElementScope) => void): El {
    const node = document.createElement(tagName);
    const parent = Builders._current;
    const scope = new ElementScope(node);
    Builders._current = scope;
    try {
      build(scope);
    } finally {
      Builders._current = parent;
    }
    parent?.node.appendChild(node);

    return new El(node);
  }

  private static currentScope(): ElementScope {
    return Builders._current ?? throwError(new InvalidOperationException("Add runs only inside an element builder."));
  }
}
