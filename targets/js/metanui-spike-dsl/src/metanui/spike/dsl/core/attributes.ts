import { isString } from "metano-runtime";
import { Reactivity } from "metanui-reactive/metanui/reactive";
import { AttributePart } from "./attribute-part.js";
import type { Part } from "./part.js";
import { ReactiveTextPart } from "./reactive-text-part.js";

export class Attributes {
  private constructor() { }

  static classString(value: string): Part {
    return new AttributePart((element) => element.className = value);
  }

  static classFuncOfString(value: () => string): Part {
    return new AttributePart((element) => Reactivity.effect(value, (current: string, previous: string) => element.className = current));
  }

  static class(value: string): Part;
  static class(value: () => string): Part;
  static class(...args: unknown[]): Part {
    if (args.length === 1 && isString(args[0])) {
      return Attributes.classString(args[0] as string);
    }

    if (args.length === 1 && typeof args[0] === "function") {
      return Attributes.classFuncOfString(args[0] as () => string);
    }

    throw new Error("No matching overload for class");
  }

  static onClick(handler: () => void): Part {
    return new AttributePart((element) => element.addEventListener("click", handler));
  }

  static text(text: () => string): Part {
    return new ReactiveTextPart(text);
  }
}
