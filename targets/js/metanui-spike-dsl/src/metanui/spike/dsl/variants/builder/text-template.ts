import { List, throwModified } from "metano-runtime/system/collections";
import { objectText, type ClassType } from "metano-runtime";
import { Signal } from "metanui-reactive/metanui/reactive";

let TextTemplate$rt: ClassType<TextTemplate> | undefined;

export class TextTemplate {
  declare private readonly _parts: List<() => string>;

  constructor(literalLength: number, formattedCount: number) {
    this._parts = List.of<() => string>([]);
  }

  static get $runtimeType(): ClassType<TextTemplate> {
    return (TextTemplate$rt ??= {
      kind: "class",
      name: "TextTemplate",
      fullName: "Metanui.Spike.Dsl.Variants.Builder.TextTemplate",
      namespace: "Metanui.Spike.Dsl.Variants.Builder",
      ctor: TextTemplate,
      interfaces: [],
      typeParameters: [],
      isAbstract: false,
      isValueType: false,
      test: (v: unknown): v is TextTemplate => v instanceof TextTemplate,
    });
  }

  appendLiteral(literal: string): void {
    this._parts.add(() => literal);
  }

  appendFormattedSignal<T>(signal: Signal<T>): void {
    this._parts.add(() => `${objectText(signal.value ?? "")}`);
  }

  appendFormattedValue<T>(value: T): void {
    const text = `${objectText(value ?? "")}`;
    this._parts.add(() => text);
  }

  appendFormatted<T>(signal: Signal<T>): void;
  appendFormatted<T>(value: T): void;
  appendFormatted(...args: unknown[]): any {
    if (args.length === 1 && args[0] instanceof Signal) {
      this.appendFormattedSignal(args[0] as any);

      return;
    }

    if (args.length === 1) {
      this.appendFormattedValue(args[0] as any);

      return;
    }

    throw new Error("No matching overload for appendFormatted");
  }

  render(): string {
    let text = "";
    {
      const $c = typeof __METANO_CHECKS__ === "undefined" || __METANO_CHECKS__;
      const $l = this._parts;
      const $a = $l._items;
      const $n = $a.length;
      const $v = $c ? $l._version : 0;
      for (let $i = 0; ; $i++) {
        if ($c && ($l._version !== $v || $a.length !== $n)) throwModified();
        if ($i === $n) break;
        const part = $a[$i]!;
        text += part();
      }
    }

    return text;
  }
}
