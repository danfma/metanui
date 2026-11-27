import type { ClassType, IDisposable } from "metano-runtime";
import { View } from "metanui-ui/metanui/ui";
import { FakeElement } from "./fake-element.js";
import { FakePort } from "./fake-port.js";

let FakeHost$rt: ClassType<FakeHost> | undefined;

export class FakeHost {
  declare readonly port: FakePort;
  declare readonly container: FakeElement;

  constructor() {
    this.port = new FakePort();
    this.container = new FakeElement("root");
  }

  static get $runtimeType(): ClassType<FakeHost> {
    return (FakeHost$rt ??= {
      kind: "class",
      name: "FakeHost",
      fullName: "Metanui.Ui.Scenarios.Fakes.FakeHost",
      namespace: "Metanui.Ui.Scenarios.Fakes",
      ctor: FakeHost,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new FakeHost(),
      test: (v: unknown): v is FakeHost => v instanceof FakeHost,
    });
  }

  render(build: () => void): IDisposable {
    return View.render(build, this.container, this.port);
  }

  print(): string {
    return this.container.printChildren();
  }
}
