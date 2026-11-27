import type { ClassType } from "metano-runtime";
import { Reactivity, type Signal } from "metanui-reactive/metanui/reactive";
import { Component, View } from "metanui-ui/metanui/ui";
import type { FakeElement } from "../fakes/fake-element.js";
import { FakeViews } from "../fakes/fake-views.js";

let TitledCard$rt: ClassType<TitledCard> | undefined;

export class TitledCard extends Component<TitledCard> {
  declare private readonly _title: Signal<string>;

  constructor() {
    super();
    this._title = Reactivity.signal("");
  }

  static override get $runtimeType(): ClassType<TitledCard> {
    return (TitledCard$rt ??= {
      kind: "class",
      name: "TitledCard",
      fullName: "Metanui.Ui.Scenarios.Components.TitledCard",
      namespace: "Metanui.Ui.Scenarios.Components",
      ctor: TitledCard,
      base: () => Component.$runtimeType,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      create: () => new TitledCard(),
      test: (v: unknown): v is TitledCard => v instanceof TitledCard,
    });
  }

  get title(): string {
    return this._title.value;
  }

  set title(value: string) {
    this._title.value = value;
  }

  static card(build: (obj: TitledCard) => void): void {
    View.mount(new TitledCard(), build);
  }

  override render(): void {
    FakeViews.box((card: FakeElement) => {
      card.text = "card";
      FakeViews.labelBuild((title: FakeElement) => View.bindWrite(() => title.text = this.title));
      this.content?.();
    });
  }
}
