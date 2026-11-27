import type { ClassType } from "metano-runtime";
import { View } from "./view.js";

let Component$rt: ClassType<Component<any>> | undefined;

export abstract class Component<TSelf extends Component<TSelf>> {
  declare content: (() => void) | null;

  constructor() {
    this.content = null;
  }

  static get $runtimeType(): ClassType<Component<any>> {
    return (Component$rt ??= {
      kind: "class",
      name: "Component`1",
      fullName: "Metanui.Ui.Component`1",
      namespace: "Metanui.Ui",
      ctor: Component,
      interfaces: [],
      typeParameters: ["TSelf"],
      isAbstract: true,
      isValueType: false,
      test: (v: unknown): v is Component<any> => v instanceof Component,
    });
  }

  static createBuild<TSelf extends Component<TSelf>>(this: new () => TSelf, build: (obj: TSelf) => void): void {
    View.mount(new this(), build);
  }

  static createDefault<TSelf extends Component<TSelf>>(this: new () => TSelf): void {
    View.mount(new this(), (_: TSelf) => {
    });
  }

  static create<TSelf extends Component<TSelf>>(this: new () => TSelf, build: (obj: TSelf) => void): void;
  static create<TSelf extends Component<TSelf>>(this: new () => TSelf): void;
  static create(this: (new () => any) & Omit<typeof Component, "prototype">, ...args: unknown[]): any {
    if (args.length === 1 && typeof args[0] === "function") {
      this.createBuild(args[0] as any);

      return;
    }

    if (args.length === 0) {
      this.createDefault();

      return;
    }

    throw new Error("No matching overload for create");
  }

  abstract render(): void;
}
