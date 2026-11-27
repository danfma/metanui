import { isString } from "metano-runtime";
import { Builder } from "metanui-ui/metanui/ui/building";
import { FakeElement } from "./fake-element.js";

export class FakeViews {
  private constructor() { }

  static box(build: (obj: FakeElement) => void): void {
    Builder.create(new FakeElement("box"), build);
  }

  static labelBuild(build: (obj: FakeElement) => void): void {
    Builder.create(new FakeElement("label"), build);
  }

  static labelText(text: string): void {
    let receiver$temp$0;
    Builder.add((receiver$temp$0 = new FakeElement("label"), receiver$temp$0.text = text, receiver$temp$0));
  }

  static label(build: (obj: FakeElement) => void): void;
  static label(text: string): void;
  static label(...args: unknown[]): void {
    if (args.length === 1 && typeof args[0] === "function") {
      FakeViews.labelBuild(args[0] as (obj: FakeElement) => void);

      return;
    }

    if (args.length === 1 && isString(args[0])) {
      FakeViews.labelText(args[0] as string);

      return;
    }

    throw new Error("No matching overload for label");
  }
}
