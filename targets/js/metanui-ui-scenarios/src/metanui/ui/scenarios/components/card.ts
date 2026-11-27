import type { ClassType } from "metano-runtime";
import { Reactivity, type Signal } from "metanui-reactive/metanui/reactive";
import { Component, View } from "metanui-ui/metanui/ui";
import type { FakeElement } from "../fakes/fake-element.js";
import { FakeViews } from "../fakes/fake-views.js";

let Card$rt: ClassType<Card> | undefined;

export class Card extends Component<Card> {
  declare private readonly _title: Signal<string>;

  constructor() {
    super();
    this._title = Reactivity.signal("");
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

  get title(): string {
    return this._title.value;
  }

  set title(value: string) {
    this._title.value = value;
  }

  static create(build: (obj: Card) => void): void {
    View.mount(new Card(), build);
  }

  override render(): void {
    FakeViews.box((card: FakeElement) => {
      card.text = "card";
      FakeViews.labelBuild((title: FakeElement) => View.bindWrite(() => title.text = this.title));
      this.content?.();
    });
  }
}
