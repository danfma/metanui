import type { ClassType } from "metano-runtime";
import { Component, Prop, View } from "metanui-ui/metanui/ui";
import type { FakeElement } from "../fakes/fake-element.js";
import { FakeViews } from "../fakes/fake-views.js";

let Card$rt: ClassType<Card> | undefined;

export class Card extends Component<Card> {
  declare title: Prop<string>;

  constructor() {
    super();
    this.title = Prop.__implicitFromT("");
  }

  static override get $runtimeType(): ClassType<Card> {
    return (Card$rt ??= {
      kind: "class",
      name: "Card",
      fullName: "Metanui.Ui.Scenarios.Components.Card",
      namespace: "Metanui.Ui.Scenarios.Components",
      ctor: Card,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new Card(),
      test: (v: unknown): v is Card => v instanceof Card,
    });
  }

  override render(): void {
    FakeViews.box((card: FakeElement) => {
      card.text = "card";
      FakeViews.labelBuild((title: FakeElement) => View.bindWrite(() => title.text = this.title.value));
      this.content?.();
    });
  }
}
