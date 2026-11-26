import { El } from "./el.js";
import type { Part } from "./part.js";

export class Elements {
  private constructor() { }

  static div(...parts: Part[]): El {
    return El.create("div", parts);
  }

  static section(...parts: Part[]): El {
    return El.create("section", parts);
  }

  static h2(...parts: Part[]): El {
    return El.create("h2", parts);
  }

  static p(...parts: Part[]): El {
    return El.create("p", parts);
  }

  static span(...parts: Part[]): El {
    return El.create("span", parts);
  }

  static button(...parts: Part[]): El {
    return El.create("button", parts);
  }
}
